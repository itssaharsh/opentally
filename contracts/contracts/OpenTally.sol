// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title OpenTally: one results-based financing programme as a public ledger.
/// @notice A funder deposits the grant pool; site gateways sign monthly consumption summaries; the contract
///         verifies the signatures, applies the programme's rule after the sampling window, skips anything the
///         verifier has held, and pays each eligible connection's grant to its site in one transaction.
/// @dev Roles: owner (the programme operator: registers sites and connections, submits summaries, runs the
///      release), verifier (hold and lift only), funder (deposit only). Site gateways only sign.
contract OpenTally is EIP712 {
    using SafeERC20 for IERC20;

    struct Rule {
        uint16 activeDaysMin;
        uint32 kwhMilliMin;
        uint32 windowSeconds;
    }

    struct Site {
        string name;
        address payout;
        address gateway;
        uint32 connectionCount;
    }

    struct ConnectionInput {
        uint16 siteId;
        bytes32 meterHash;
        bytes32 customerHash;
        bytes32 gpsCell;
        uint64 commissionedAt;
    }

    struct Connection {
        uint16 siteId;
        bytes32 meterHash;
        bytes32 customerHash;
        bytes32 gpsCell;
        uint64 commissionedAt;
        bool paid;
        bool held;
        uint8 holdReason;
        uint32 paidMonth;
    }

    struct Summary {
        uint32 connectionId;
        uint32 month;
        uint16 activeDays;
        uint32 kwhMilli;
        bytes32 traceHash;
    }

    struct StoredSummary {
        uint16 activeDays;
        uint32 kwhMilli;
        bytes32 traceHash;
        bool exists;
    }

    bytes32 private constant SUMMARY_TYPEHASH =
        keccak256("Summary(uint32 connectionId,uint32 month,uint16 activeDays,uint32 kwhMilli,bytes32 traceHash)");

    IERC20 public immutable token;
    address public immutable owner;
    address public immutable verifier;
    address public immutable funder;
    uint256 public immutable grantPerConnection;
    Rule public rule;
    string public programmeName;

    Site[] private _sites;
    Connection[] private _connections;
    mapping(uint32 month => mapping(uint32 connectionId => StoredSummary)) private _summaries;
    mapping(uint32 month => uint64) public batchSubmittedAt;
    mapping(uint32 month => uint32) public releasedCount;
    uint32 public paidCount;
    uint256 public paidTotal;

    event SiteRegistered(uint16 indexed siteId, string name, address payout, address gateway);
    event ConnectionRegistered(uint32 indexed connectionId, uint16 indexed siteId, bytes32 meterHash);
    event Deposited(address indexed from, uint256 amount);
    event SummariesSubmitted(uint32 indexed month, uint32 count, uint64 submittedAt, uint64 windowClosesAt);
    event Held(uint32 indexed connectionId, uint8 reason, address by);
    event Lifted(uint32 indexed connectionId, address by);
    event Released(uint32 indexed connectionId, uint32 indexed month, uint16 indexed siteId, uint256 amount);
    event ReleaseBatch(uint32 indexed month, uint32 count, uint256 total);

    error NotOwner();
    error NotVerifier();
    error NotFunder();
    error UnknownSite(uint16 siteId);
    error UnknownConnection(uint32 connectionId);
    error LengthMismatch();
    error BadSignature(uint32 connectionId);
    error AlreadySubmitted(uint32 connectionId, uint32 month);
    error NothingSubmitted(uint32 month);
    error WindowOpen(uint64 secondsLeft);
    error InsufficientEscrow(uint256 needed, uint256 available);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyVerifier() {
        if (msg.sender != verifier) revert NotVerifier();
        _;
    }

    constructor(
        IERC20 token_,
        address owner_,
        address verifier_,
        address funder_,
        uint256 grantPerConnection_,
        Rule memory rule_,
        string memory programmeName_
    ) EIP712("OpenTally", "1") {
        token = token_;
        owner = owner_;
        verifier = verifier_;
        funder = funder_;
        grantPerConnection = grantPerConnection_;
        rule = rule_;
        programmeName = programmeName_;
    }

    // ---------------------------------------------------------------- registration and funding

    function registerSite(string calldata name, address payout, address gateway) external onlyOwner returns (uint16 siteId) {
        siteId = uint16(_sites.length);
        _sites.push(Site({name: name, payout: payout, gateway: gateway, connectionCount: 0}));
        emit SiteRegistered(siteId, name, payout, gateway);
    }

    function registerConnections(ConnectionInput[] calldata inputs) external onlyOwner {
        for (uint256 i = 0; i < inputs.length; i++) {
            ConnectionInput calldata c = inputs[i];
            if (c.siteId >= _sites.length) revert UnknownSite(c.siteId);
            uint32 id = uint32(_connections.length);
            _connections.push(
                Connection({
                    siteId: c.siteId,
                    meterHash: c.meterHash,
                    customerHash: c.customerHash,
                    gpsCell: c.gpsCell,
                    commissionedAt: c.commissionedAt,
                    paid: false,
                    held: false,
                    holdReason: 0,
                    paidMonth: 0
                })
            );
            _sites[c.siteId].connectionCount += 1;
            emit ConnectionRegistered(id, c.siteId, c.meterHash);
        }
    }

    /// @notice The funder moves grant money into the escrow. Anyone may top up; the event names who did.
    function deposit(uint256 amount) external {
        if (msg.sender != funder && msg.sender != owner) revert NotFunder();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    // ---------------------------------------------------------------- summaries

    /// @notice Submit one month's summaries. Every summary must be signed by its connection's site gateway;
    ///         one bad signature reverts the whole batch, so nothing half-lands.
    function submitSummaries(uint32 month, Summary[] calldata items, bytes[] calldata signatures) external onlyOwner {
        if (items.length != signatures.length) revert LengthMismatch();
        for (uint256 i = 0; i < items.length; i++) {
            Summary calldata s = items[i];
            if (s.connectionId >= _connections.length) revert UnknownConnection(s.connectionId);
            if (s.month != month) revert LengthMismatch();
            if (_summaries[month][s.connectionId].exists) revert AlreadySubmitted(s.connectionId, month);
            address expected = _sites[_connections[s.connectionId].siteId].gateway;
            bytes32 digest = _hashTypedDataV4(
                keccak256(abi.encode(SUMMARY_TYPEHASH, s.connectionId, s.month, s.activeDays, s.kwhMilli, s.traceHash))
            );
            (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signatures[i]);
            if (err != ECDSA.RecoverError.NoError || signer != expected) revert BadSignature(s.connectionId);
            _summaries[month][s.connectionId] =
                StoredSummary({activeDays: s.activeDays, kwhMilli: s.kwhMilli, traceHash: s.traceHash, exists: true});
        }
        uint64 nowTs = uint64(block.timestamp);
        batchSubmittedAt[month] = nowTs;
        emit SummariesSubmitted(month, uint32(items.length), nowTs, nowTs + rule.windowSeconds);
    }

    // ---------------------------------------------------------------- holds

    function hold(uint32 connectionId, uint8 reason) external onlyVerifier {
        if (connectionId >= _connections.length) revert UnknownConnection(connectionId);
        Connection storage c = _connections[connectionId];
        c.held = true;
        c.holdReason = reason;
        emit Held(connectionId, reason, msg.sender);
    }

    /// @notice Hold several connections in one transaction (the screen's flags for a month).
    function holdMany(uint32[] calldata connectionIds, uint8[] calldata reasons) external onlyVerifier {
        if (connectionIds.length != reasons.length) revert LengthMismatch();
        for (uint256 i = 0; i < connectionIds.length; i++) {
            uint32 id = connectionIds[i];
            if (id >= _connections.length) revert UnknownConnection(id);
            Connection storage c = _connections[id];
            c.held = true;
            c.holdReason = reasons[i];
            emit Held(id, reasons[i], msg.sender);
        }
    }

    function lift(uint32 connectionId) external onlyVerifier {
        if (connectionId >= _connections.length) revert UnknownConnection(connectionId);
        Connection storage c = _connections[connectionId];
        c.held = false;
        c.holdReason = 0;
        emit Lifted(connectionId, msg.sender);
    }

    // ---------------------------------------------------------------- the rule and the release

    function windowClosesAt(uint32 month) public view returns (uint64) {
        uint64 at = batchSubmittedAt[month];
        return at == 0 ? 0 : at + rule.windowSeconds;
    }

    function meetsRule(uint32 month, uint32 connectionId) public view returns (bool) {
        StoredSummary storage s = _summaries[month][connectionId];
        if (!s.exists) return false;
        return s.activeDays >= rule.activeDaysMin && s.kwhMilli >= rule.kwhMilliMin;
    }

    /// @notice Connections that would be paid by `release(month)` right now.
    function eligible(uint32 month) public view returns (uint32[] memory ids) {
        uint256 n = _connections.length;
        uint32[] memory buf = new uint32[](n);
        uint256 k;
        for (uint32 i = 0; i < n; i++) {
            Connection storage c = _connections[i];
            if (c.paid || c.held) continue;
            if (!meetsRule(month, i)) continue;
            buf[k++] = i;
        }
        ids = new uint32[](k);
        for (uint256 j = 0; j < k; j++) ids[j] = buf[j];
    }

    /// @notice Pay every eligible, unheld connection's grant to its site, once the sampling window has closed.
    ///         Calling it again pays nothing and says so: ReleaseBatch(month, 0, 0).
    function release(uint32 month) external onlyOwner {
        uint64 submittedAt = batchSubmittedAt[month];
        if (submittedAt == 0) revert NothingSubmitted(month);
        uint64 closesAt = submittedAt + rule.windowSeconds;
        if (block.timestamp < closesAt) revert WindowOpen(closesAt - uint64(block.timestamp));

        uint256 nSites = _sites.length;
        uint256[] memory perSite = new uint256[](nSites);
        uint32 count;
        uint256 total;
        uint256 n = _connections.length;
        for (uint32 i = 0; i < n; i++) {
            Connection storage c = _connections[i];
            if (c.paid || c.held) continue;
            if (!meetsRule(month, i)) continue;
            c.paid = true;
            c.paidMonth = month;
            perSite[c.siteId] += grantPerConnection;
            count += 1;
            total += grantPerConnection;
            emit Released(i, month, c.siteId, grantPerConnection);
        }
        uint256 available = token.balanceOf(address(this));
        if (total > available) revert InsufficientEscrow(total, available);
        for (uint16 s = 0; s < nSites; s++) {
            if (perSite[s] > 0) token.safeTransfer(_sites[s].payout, perSite[s]);
        }
        paidCount += count;
        paidTotal += total;
        releasedCount[month] += count;
        emit ReleaseBatch(month, count, total);
    }

    // ---------------------------------------------------------------- views

    function escrowBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function siteCount() external view returns (uint256) {
        return _sites.length;
    }

    function connectionCount() external view returns (uint256) {
        return _connections.length;
    }

    function getSite(uint16 siteId) external view returns (Site memory) {
        if (siteId >= _sites.length) revert UnknownSite(siteId);
        return _sites[siteId];
    }

    function getConnection(uint32 connectionId) external view returns (Connection memory) {
        if (connectionId >= _connections.length) revert UnknownConnection(connectionId);
        return _connections[connectionId];
    }

    function getSummary(uint32 month, uint32 connectionId) external view returns (StoredSummary memory) {
        return _summaries[month][connectionId];
    }

    function summaryDigest(Summary calldata s) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(SUMMARY_TYPEHASH, s.connectionId, s.month, s.activeDays, s.kwhMilli, s.traceHash))
        );
    }
}
