const { ethers } = require("hardhat");

const networkConfig = {
    1: {
        name: "mainnet",
    },
    5: {
        name: "goerli",
    },
    137: {
        name: "polygon",
    },
    31337: {
        name: "localhost",
    },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
    networkConfig,
    developmentChains,
};
