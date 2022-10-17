const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          let lottery, lotteryContract, vrfCoordinatorV2Mock, raffleEntranceFee, interval, user, deployer;
          const chainId = network.config.chainId;

          beforeEach(async () => {
              accounts = await ethers.getSigners();
              deployer = accounts[0];
              user = accounts[1];
              await deployments.fixture("all");
              lotteryContract = await ethers.getContract("Lottery");
              lottery = lotteryContract.connect(user);
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              raffleEntranceFee = await lottery.getEntranceFee();
              interval = await lottery.getInterval();
          });

          describe("constructor", function () {
              it("initializes the lottery state correctly", async () => {
                  const lotteryState = await lottery.getRaffleState();
                  assert.equal(lotteryState.toString(), "0");
              });
              it("initializes the interval correctly", async () => {
                  assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"]);
              });
              it("initializes the callback gas liimit correctly", async () => {
                  const callbackGasLimit = await lottery.getCallBackGasLimit();
                  assert.equal(callbackGasLimit.toString(), networkConfig[chainId]["callbackGasLimit"]);
              });
              it("initializes the entrance fee correctly", async () => {
                  const entranceFee = await lottery.getEntranceFee();
                  assert.equal(entranceFee.toString(), networkConfig[chainId]["raffleEntranceFee"]);
              });
          });

          describe("enterRaffle", function () {
              it("reverts if there is not enough ETH for the entrance fee", async () => {
                  await expect(lottery.enterRaffle()).to.be.revertedWith("Lottery__NotEnoughEthEntered");
              });
              it("records players when they enter", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  const players = await lottery.getNumberOfPlayers();
                  assert.equal(players.toString(), "1");
              });
              it("records players address when they enter", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  const contractPlayer = await lottery.getPlayer(0);
                  assert.equal(user.address, contractPlayer);
              });
              it("emits event on enter", async () => {
                  await expect(lottery.enterRaffle({ value: raffleEntranceFee })).to.emit(lottery, "RaffleEnter");
              });
              it("doesnt allow entrance when raffle is calculating", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  // Moving the blockchain forward in time and mineing the block to set the block timestamp
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  // Impersonate the keeper to call performUpkeep and change raffleState to CALCULATING
                  await lottery.performUpkeep([]);
                  await expect(lottery.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Lottery__CalculatingNotOpen"
                  );
              });
          });

          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("returns false if lottery is CALCULATING", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await lottery.performUpkeep([]);
                  const raffleState = await lottery.getRaffleState();
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  assert.equal(raffleState == 1, upkeepNeeded == false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) - 5]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, has ETH, and is open", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await lottery.performUpkeep([]);
                  assert(tx);
              });
              it("reverts if checkUpkeep returns false", async () => {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded");
              });
              it("updates the lottery state", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await lottery.performUpkeep([]);
                  const raffleState = await lottery.getRaffleState();
                  assert(raffleState == 1);
              });
              it("emits a requestId", async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const transactionResponse = await lottery.performUpkeep([]);
                  const transactionReceipt = await transactionResponse.wait(1);
                  const requestId = transactionReceipt.events[1].args.requestId;
                  assert(parseInt(requestId) > 0);
              });
          });

          describe("fullfillRandomWords", function () {
              beforeEach(async () => {
                  await lottery.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [parseInt(interval) + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async () => {
                  await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith(
                      "nonexistent request"
                  );
                  await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith(
                      "nonexistent request"
                  );
              });
              it("picks a winner, resets the lottery, and sends the ETH", async () => {
                  const additionalEntrances = 3;
                  const startingIndex = 2;
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      lottery = lottery.connect(accounts[i]);
                      await lottery.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimeStamp = await lottery.getLastTimeStamp();

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await lottery.getRecentWinner();
                              const raffleState = await lottery.getRaffleState();
                              const winnerBalance = await accounts[2].getBalance();
                              const endingTimeStamp = await lottery.getLastTimeStamp();
                              await expect(lottery.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[2].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance
                                      .add(raffleEntranceFee.mul(additionalEntrances).add(raffleEntranceFee))
                                      .toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (e) {
                              reject(e);
                          }
                      });

                      const tx = await lottery.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);
                      const startingBalance = await accounts[2].getBalance();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          lottery.address
                      );
                  });
              });
          });
          describe("pure functions", function () {
              it("returns the request confrimations correctly", async () => {
                  const requestConfirmations = await lottery.getRequestConfirmations();
                  assert.equal(requestConfirmations.toString(), "3");
              });
              it("returns the number of random words correctly", async () => {
                  const numWords = await lottery.getNumWords();
                  assert.equal(numWords.toString(), "1");
              });
          });
      });
