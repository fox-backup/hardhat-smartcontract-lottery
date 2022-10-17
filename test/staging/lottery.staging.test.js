const { assert, expect } = require("chai");
const { getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
          let lottery, raffleEntranceFee, deployer;

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              lottery = await ethers.getContract("Lottery", deployer);
              raffleEntranceFee = await lottery.getEntranceFee();
          });
          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we ge a random winner", async () => {
                  console.log("Setting up test...");
                  const startingTimeStamp = await lottery.getLastTimeStamp();
                  const accounts = await ethers.getSigners();

                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await lottery.getRecentWinner();
                              const raffleState = await lottery.getRaffleState();
                              const winnerBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await lottery.getLastTimeStamp();

                              await expect(lottery.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0);
                              assert.equal(winnerBalance.toString(), startingBalance.add(raffleEntranceFee).toString());
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (e) {
                              console.log(e);
                              reject(e);
                          }
                      });

                      console.log("Entering Lottery...");
                      const tx = await lottery.enterRaffle({ value: raffleEntranceFee });
                      await tx.wait(1);
                      console.log("Time to wait...");
                      const startingBalance = await accounts[0].getBalance();
                  });
              });
          });
      });
