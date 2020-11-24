pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the owner.
 */
contract TokenVesting is Ownable {
    // The vesting schedule is time-based (i.e. using block timestamps as opposed to e.g. block numbers), and is
    // therefore sensitive to timestamp manipulation (which is something miners can do, to a certain degree). Therefore,
    // it is recommended to avoid using short time durations (less than a minute). Typical vesting schemes, with a
    // cliff period of a year and a duration of four years, are safe to use.
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event Registered(address account, uint256 amount);
    event Revoked(address account);
    event Claimed(address account, uint256 amount);

    address public vestingToken;
    uint256 public totalReleased;
    uint256 public totalAllocated;

    struct Beneficiary {
        uint256 start;
        uint256 cliff;
        uint256 duration;
        uint256 amount;
        uint256 released;
        bool revocable;
        bool revoked;
        bool initialized;
    }

    mapping(address => Beneficiary) private _vestingBeneficiaries;

    modifier isRegistered(address account) {
        require(
            _vestingBeneficiaries[account].initialized,
            "TokenVesting: not registered"
        );
        _;
    }

    /**
     * @dev Sets the values for vestingToken. VestingToken is immutable:
     * they can only be set once during construction.
     */

    constructor(address token) public {
        vestingToken = token;
    }

    /* ========== External View FUNCTIONS ========== */

    /**
     * @return The cliff time of the token vesting.
     */
    function cliff(address account) external view returns (uint256) {
        return _vestingBeneficiaries[account].cliff;
    }

    /**
     * @return The start time of the token vesting.
     */
    function start(address account) external view returns (uint256) {
        return _vestingBeneficiaries[account].start;
    }

    /**
     * @return The duration of the token vesting.
     */
    function duration(address account) external view returns (uint256) {
        return _vestingBeneficiaries[account].duration;
    }

    /**
     * @return True if the vesting is revocable.
     */
    function revocable(address account) external view returns (bool) {
        return _vestingBeneficiaries[account].revocable;
    }

    /**
     * @return The amount of the token released.
     */
    function released(address account) external view returns (uint256) {
        return _vestingBeneficiaries[account].released;
    }

    /**
     * @return True if the token is revoked.
     */
    function revoked(address account) external view returns (bool) {
        return _vestingBeneficiaries[account].revoked;
    }

    /**
     * @return The amount of vesting token
     */
    function amount(address account) external view returns (uint256) {
        return _vestingBeneficiaries[account].amount;
    }

    /**
     * @return True if the account is initialized.
     */
    function initialized(address account) external view returns (bool) {
        return _vestingBeneficiaries[account].initialized;
    }

    /**
     * @dev Add beneficiary with related information to the vesting contract
     * @param _account address of the beneficiary to whom vested tokens are transferred
     * @param _start the time (as Unix time) at which point vesting starts
     * @param _cliffDuration duration in seconds of the cliff in which tokens will begin to vest
     * @param _duration duration in seconds of the period in which the tokens will vest
     * @param _amount the vesting amount of beneficiary
     * @param _revocable whether the vesting is revocable or not
     */
    function register(
        address _account,
        uint256 _start,
        uint256 _cliffDuration,
        uint256 _duration,
        uint256 _amount,
        bool _revocable
    ) external onlyOwner {
        require(
            !_vestingBeneficiaries[_account].initialized,
            "TokenVesting: account has been registered"
        );
        require(
            _account != address(0),
            "TokenVesting: account is zero address"
        );
        require(
            _cliffDuration <= _duration,
            "TokenVesting: cliff is longer than duration"
        );
        require(_duration > 0, "TokenVesting: duration is 0");
        require(
            _start.add(_duration) > block.timestamp,
            "TokenVesting: final time is before current time"
        );
        require(
            totalAllocated.sub(totalReleased).add(_amount) <=
                IERC20(vestingToken).balanceOf(address(this)),
            "TokenVesting: insufficient balance"
        );

        Beneficiary memory beneficiary = Beneficiary(
            _start,
            _start.add(_cliffDuration),
            _duration,
            _amount,
            0,
            _revocable,
            false,
            true
        );
        _vestingBeneficiaries[_account] = beneficiary;
        totalAllocated = totalAllocated.add(_amount);
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param _account The address of beneficiary
     */
    function claim(address _account)
        external
        isRegistered(_account)
        returns (uint256)
    {
        Beneficiary storage beneficiary = _vestingBeneficiaries[_account];
        uint256 unreleasedAmt = _releasableAmount(beneficiary);
        require(unreleasedAmt > 0, "TokenVesting: no tokens are due");

        beneficiary.released = beneficiary.released.add(unreleasedAmt);
        totalReleased = totalReleased.add(unreleasedAmt);
        IERC20(vestingToken).safeTransfer(_account, unreleasedAmt);
        emit Claimed(_account, unreleasedAmt);
        return unreleasedAmt;
    }

    /**
     * @notice Allows the owner to revoke the vesting. Tokens already vested
     * remain in the contract, but the amount will be updated.
     * @param _account The address of beneficiary
     */
    function revoke(address _account)
        external
        onlyOwner
        isRegistered(_account)
    {
        Beneficiary storage beneficiary = _vestingBeneficiaries[_account];
        require(beneficiary.revocable, "TokenVesting: cannot revoke");
        require(!beneficiary.revoked, "TokenVesting: account already revoked");

        uint256 unreleasedAmt = _releasableAmount(beneficiary);
        uint256 refund = beneficiary.amount.sub(
            beneficiary.released.add(unreleasedAmt)
        );

        // the amount of beneficiary will minus refund amount
        // claim amount = new amount - released amount
        beneficiary.amount = beneficiary.amount.sub(refund);
        beneficiary.revoked = true;
        totalAllocated = totalAllocated.sub(refund);
        emit Revoked(_account);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param _beneficiary The related information of beneficiary
     */
    function _releasableAmount(Beneficiary storage _beneficiary)
        private
        view
        returns (uint256)
    {
        return _vestedAmount(_beneficiary).sub(_beneficiary.released);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param _beneficiary The related information of beneficiary
     */
    function _vestedAmount(Beneficiary storage _beneficiary)
        private
        view
        returns (uint256)
    {
        if (block.timestamp < _beneficiary.cliff) {
            return 0;
        } else if (
            block.timestamp >= _beneficiary.start.add(_beneficiary.duration) ||
            _beneficiary.revoked
        ) {
            return _beneficiary.amount;
        } else {
            return
                _beneficiary
                    .amount
                    .mul(block.timestamp.sub(_beneficiary.start))
                    .div(_beneficiary.duration);
        }
    }
}
