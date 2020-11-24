# Contributing to Furucombo

## Creating merge requests (MRs)

Any direct modification to develop branch is prohibited. Please work on your own fork and submit merge requests. The MRs will be reviewed and commented. CI test should pass and every comment should be resolved before the MR is merged back to develop.

## A typical workflow

1. Make sure your fork is updated

```
cd legotoken
git remote add upstream git@garage.dinngo.co:furucombo/legotoken.git
git fetch upstream
git rebase upstream/develop
```

2. Branch out from develop

```
git checkout -b some-feature
```

3. Do your work and **Unit test**, commit and push to your fork

```
git add contracts/yourFile.sol tests/yourFile.test.js
git commit "some-feature"
git push origin some-feature
```

4. Update [changelog](CHANGELOG.md). Description should be written under proper tag in the **unreleased** section. You may refer to [here](https://keepachangelog.com/en/1.0.0/).

5. Issue a new MR
