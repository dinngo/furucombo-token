# Furucombo Token

## Overview

Furucombo token and related contract repo

### Installation

```console
$ npm install
```

### Test

The testing is performed through the fork function of [ganache-cli](https://github.com/trufflesuite/ganache-cli). The location of the data source is defined under `$ETH_MAINNET_NODE`. You may perform the testing by your own ethereum mainnet node instance or service provider like [Infura](https://infura.io/).

```console
$ export ETH_MAINNET_NODE=https://mainnet.infura.io/v3/{Your_project_ID}
$ npm run test
```

or

```console
$ ETH_MAINNET_NODE=https://mainnet.infura.io/v3/{Your_project_ID} npm run test
```


## License

Furucombo Token is released under the [MIT License](LICENSE).
