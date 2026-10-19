# User testing results

No one from a results-based financing programme, a mini-grid developer or a verification agent has used OpenTally yet. This page says what testing has been done, what it found, and how the first real test will run.

## What was tested

| Test | Who | What they did | What it found | What changed |
|---|---|---|---|---|
| Cold read of the one-line pitch | a fresh AI agent playing a judge at the end of a long day, given only the pitch and the before and after | retold the idea in one line, asked its first question, said whether it would open the link | it kept the user and the pain; its first question was "who decides a connection met the rule: a meter feed, or a person clicking approve?" | the release was made callable by anyone after the window, so the answer is "the contract; the rule decides who is paid" |
| The five steps on the first screen | automated browser tests on a production build | pressed the release, opened a held connection, lifted the hold, ran the re-sum, opened every state | every step works; a held connection showed a 404 before its page existed | the connection page was built before deployment |
| Two visitors at once | automated browser test | two people opened the demo while one ran it | the second visitor first landed on the programme being run | each visitor now opens a fresh programme, and a run keeps its programme in the address bar |

These are not user tests. They test that the product does what it says and that the pitch survives a cold read.

## The first real test

**Who:** two programme or grants staff from a results-based financing facility and two finance leads from mini-grid developers.

**Script (20 minutes each):**
1. Open the first screen without explanation. Ask: what is this, and who is it for? (Pass: they name the grant and the programme.)
2. Ask them to release this month's grants. Time it. (Pass: under 30 seconds without help.)
3. Ask why three connections were not paid, and what they would do about one of them. (Pass: they open a held connection and use the hold controls.)
4. Ask whether they would trust the total, and how they would check it. (Pass: they find the re-sum.)
5. Ask what would stop their programme from using this. Write the answer down verbatim.

**What counts as a result:** the verbatim answers to steps 1 and 5, the time for step 2, and whether steps 3 and 4 were found without help.
