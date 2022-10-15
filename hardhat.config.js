require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

/// @type import('hardhat/config').HardhatUserConfig

const GOERLI_RPC_URL = process.env.ALCHEMY_GOERLI_RPC_URL;
const MAINNET_RPC_URL = process.env.ALCHEMY_MAINNET_RPC_URL;
const POLYGON_RPC_URL = process.env.ALCHEMY_POLYGON_RPC_URL;
const OPTIMISM_RPC_URL = process.env.ALCHEMY_OPTIMISM_RPC_URL;
const OPTIMISM_GOERLI_RPC_URL = process.env.ALCHEMY_OPTIMISM_GOERLI_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

module.exports = {
    defaultNetwork: "hardhat",
    solidity: "0.8.17",
    networks: {
        hardhat: {
            chainId: 31337,
        },
        // mainnet: {
        //     url: MAINNET_RPC_URL,
        //     accounts: [PRIVATE_KEY],
        //     chainId: 1,
        //     blockConfirmations: 6,
        // },
        goerli: {
            url: GOERLI_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 5,
            blockConfirmations: 6,
        },
        // optimism: {
        //     url: OPTIMISM_RPC_URL,
        //     accounts: [PRIVATE_KEY],
        //     chainId: 10,
        //     blockConfirmations: 6,
        // },
        // optimismGoerli: {
        //     url: OPTIMISM_GOERLI_RPC_URL,
        //     accounts: [PRIVATE_KEY],
        //     chainId: 420,
        //     blockConfirmations: 6,
        // },
        // polygon: {
        //     url: POLYGON_RPC_URL,
        //     accounts: [PRIVATE_KEY],
        //     chainId: 137,
        //     blockConfirmations: 6,
        // },
        localhost: {
            url: "http://127.0.0.1:8545/",
            // account: hardhat supplied them,
            chainId: 31337,
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: true,
        outputFile: "gasReport.txt",
        noColors: true,
        currency: "USD",
        // coinmarketcap: COINMARKETCAP_API_KEY,
        // token: "ETH",
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 500000,
    },
};
