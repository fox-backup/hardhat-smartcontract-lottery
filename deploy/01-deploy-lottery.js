const { network, ethers } = require("hardhat");
const { networkConfig, developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUINT = ethers.utils.parseEther("1");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;

    if (chainId == 31337) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = await transactionReceipt.events[0].args.subId;
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUINT);
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }
    const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;

    const gasLane = networkConfig[chainId]["gasLane"];
    const entranceFee = networkConfig[chainId]["raffleEntranceFee"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["keepersUpdateInterval"];

    const arguments = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];

    log("Deploying Lottery.sol!");
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmaions: waitBlockConfirmations,
    });
    log("----------------------------------------------------------");

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying Lottery.sol on Etherscan...");
        await verify(lottery.address, arguments);
    }

    //     log("Enter lottery with command:");
    //     const networkName = network.name == "hardhat" ? "localhost" : network.name;
    //     log(`yarn hardhat run scripts/enterRaffle.js --network ${networkName}`);
    //     log("----------------------------------------------------------");
};

module.exports.tags = ["all", "lottery"];
