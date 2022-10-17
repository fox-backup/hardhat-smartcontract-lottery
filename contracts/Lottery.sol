// Raffle

// Steps
// Enter the lottery (paying some amount {multiple pools for different amounts [.01, .05, .1, .5, 1]})
// Pick a random winner (verifiably random)
// winner to be selected every x minutes, days, weeks, months, years

// Tools
// Chainlink Oracles -> Randomness (VRF), Automated Execution (Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Lottery__NotEnoughEthEntered();
error Lottery_TransferFailed();
error Lottery__CalculatingNotOpen();
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 RaffleState);

/**
 * @title A sample Raffle Contract
 * @author Nathan Moudakis
 * @notice This contract is for creating a untamperable decentralized smart contract
 * @dev This implements Chainlink VRF Coordinator V2 and Chainlink Keepers
 */
contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // Type Declarations
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // State Variables

    // Chainlink VRF Variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    uint256 private immutable i_interval;
    uint256 private immutable i_entranceFee;
    uint256 private s_lastTimeStamp;
    address private s_recentWinner;
    address payable[] private s_players;
    RaffleState private s_raffleState;

    // Events
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    // Funcitons
    constructor(
        address vrfCoordinatorV2, // contract, will need mock
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_interval = interval;
        i_subscriptionId = subscriptionId;
        i_entranceFee = entranceFee;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_callbackGasLimit = callbackGasLimit;
    }

    /**
     * @dev This is the function used to enter the Lottery.
     * A user will enter with an eth amount.
     * If the amount is not enough ETH, the transaction will revert with the NotEnoughEthEntered custom error.
     * If the Lottery is calculating the winner or performing another action that doesn't allow submissions the
     * transaction will revert with custom errror CalculatingNotOpen.
     * The players array is updated after the value and state has been confirmed.
     * The address of the sender is emited to the RaffleEnter Event
     */
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__NotEnoughEthEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Lottery__CalculatingNotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for the `upkeepNeeded` to return true.
     * The following should be true in order to return true.
     * 1. Our time interval should have passed
     * 2. The lottery should have at least one player and have some ETH
     * 3. Our subscription should be funded with LINK
     * 4. The lottery should be in an open state
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x0");
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call to
     * perform an action when `upkeepNeeded` is returned to be true.
     * The function first checks to be sure that upkeep is indeed needed.
     * If no upkeep is needed the transaction is reverteded with UpkeepNotNeeded custom error.
     * The raffle state is updated to CALCULATING to avoid new entries.
     * A randomWord is requested to get a random number.
     */
    function performUpkeep(
        bytes calldata /* checkData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, //keyHash
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    /**
     * @dev This function takes the random number that is produced by the Chainlink
     * Keeper node and uses it to calculate a verifiably random number.
     * The winners index is chosen by taking the modulus of the random number and player length.
     * The player array is reset.
     * The State of the lottery is switched back to open.
     * The timestamp is recorded.
     * The ETH in the lottery is sent to the winner, if the transaction fails the function reverts
     * with custom error TransferFailed
     * Event is recorded with the winner
     */
    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery_TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    // View / Pure Functions
    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getCallBackGasLimit() public view returns (uint256) {
        return i_callbackGasLimit;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }
}
