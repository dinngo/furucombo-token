const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase, latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const Combo = artifacts.require('COMBO');
const TokenVesting = artifacts.require('TokenVesting');

contract('TokenVesting', function([_, user, someone]) {
  before(async function() {
    const mintAmount = ether('1000000'); // 1M
    this.combo = await Combo.new();
    this.vesting = await TokenVesting.new(this.combo.address);
    await this.combo.addMinter(user);
    await this.combo.mint(this.vesting.address, mintAmount, { from: user });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Register', function() {
    beforeEach(async function() {});
    afterEach(async function() {});

    it('with enough balance', async function() {
      const _account = user;
      const _start = await latest();
      const _cliffDuration = duration.days(1);
      const _duration = duration.days(10);
      const _amount = ether('100000');
      await this.vesting.register(
        _account,
        _start.toNumber(),
        _cliffDuration.toNumber(),
        _duration.toNumber(),
        _amount,
        true,
        { from: _ }
      );

      expect(await this.vesting.start(user)).to.be.bignumber.eq(_start);
      expect(await this.vesting.duration(user)).to.be.bignumber.eq(_duration);
      expect(await this.vesting.amount(user)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.released(user)).to.be.zero;
      expect(await this.vesting.initialized(user)).to.be.true;
      expect(await this.vesting.cliff(user)).to.be.bignumber.eq(
        _start.add(_cliffDuration)
      );
      expect(await this.vesting.totalAllocated()).to.be.bignumber.eq(_amount);
    });

    it('should revert: insufficient balance', async function() {
      const _account = user;
      const _start = await latest();
      const _cliffDuration = duration.days(1);
      const _duration = duration.days(10);
      const _amount = ether('2000000'); // 2M

      await expectRevert(
        this.vesting.register(
          _account,
          _start.toNumber(),
          _cliffDuration.toNumber(),
          _duration.toNumber(),
          _amount,
          true,
          { from: _ }
        ),
        'TokenVesting: insufficient balance'
      );
    });

    it('should revert: account has been registered', async function() {
      const _account = user;
      const _start = await latest();
      const _cliffDuration = duration.days(1);
      const _duration = duration.days(10);
      const _amount = ether('100000');

      await this.vesting.register(
        _account,
        _start.toNumber(),
        _cliffDuration.toNumber(),
        _duration.toNumber(),
        _amount,
        true,
        { from: _ }
      );

      await expectRevert(
        this.vesting.register(
          _account,
          _start.toNumber(),
          _cliffDuration.toNumber(),
          _duration.toNumber(),
          _amount,
          true,
          { from: _ }
        ),
        'TokenVesting: account has been registered'
      );
    });

    it('should revert: zero address', async function() {
      const _account = constants.ZERO_ADDRESS;
      const _start = await latest();
      const _cliffDuration = duration.days(1);
      const _duration = duration.days(10);
      const _amount = ether('100000');

      await expectRevert(
        this.vesting.register(
          _account,
          _start.toNumber(),
          _cliffDuration.toNumber(),
          _duration.toNumber(),
          _amount,
          true,
          { from: _ }
        ),
        'TokenVesting: account is the zero address'
      );
    });

    it('should revert: cliff is longer than duration', async function() {
      const _account = user;
      const _start = await latest();
      const _cliffDuration = duration.days(2);
      const _duration = duration.days(1);
      const _amount = ether('100000');

      await expectRevert(
        this.vesting.register(
          _account,
          _start.toNumber(),
          _cliffDuration.toNumber(),
          _duration.toNumber(),
          _amount,
          true,
          { from: _ }
        ),
        'TokenVesting: cliff is longer than duration'
      );
    });

    it('should revert: final time is before current time', async function() {
      const _account = user;
      const _start = await latest();
      const _cliffDuration = duration.days(1);
      const _duration = duration.days(10);
      const _amount = ether('100000');

      await expectRevert(
        this.vesting.register(
          _account,
          _start
            .sub(_duration)
            .sub(_cliffDuration)
            .toNumber(),
          _cliffDuration.toNumber(),
          _duration.toNumber(),
          _amount,
          true,
          { from: _ }
        ),
        'TokenVesting: final time is before current time'
      );
    });
  });

  describe('claim token', function() {
    var _account;
    var _start;
    var _cliffDuration;
    var _duration;
    var _amount;

    beforeEach(async function() {
      _account = user;
      _start = await latest();
      _cliffDuration = duration.days(5);
      _duration = duration.days(10);
      _amount = ether('1'); // 0.1M

      await this.vesting.register(
        _account,
        _start.toNumber(),
        _cliffDuration.toNumber(),
        _duration.toNumber(),
        _amount,
        true,
        { from: _ }
      );
    });

    // TODO: claim by other?

    it('normal over cliff under duration', async function() {
      await increase(duration.days('7'));
      const userTokenBefore = await this.combo.balanceOf(user);
      await this.vesting.claim(user, {
        from: user,
      });
      const userTokenAfter = await this.combo.balanceOf(user);

      const block = await web3.eth.getBlock('latest');
      const expectClaim = _amount
        .mul(utils.toBN(block.timestamp).sub(_start))
        .div(_duration);

      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.released(user)).to.be.bignumber.eq(expectClaim);
      expect(await this.vesting.totalReleased()).to.be.bignumber.eq(
        expectClaim
      );
    });

    it('normal over duration', async function() {
      await increase(duration.days('11'));
      const userTokenBefore = await this.combo.balanceOf(user);
      await this.vesting.claim(user, { from: user });
      const userTokenAfter = await this.combo.balanceOf(user);
      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.released(user)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.totalReleased()).to.be.bignumber.eq(_amount);
    });

    it('should revert: in cliff duration', async function() {
      await increase(duration.days('2'));
      await expectRevert(
        this.vesting.claim(user, {
          from: user,
        }),
        'TokenVesting: no tokens are due'
      );
    });

    it('should revert: account not register', async function() {
      await expectRevert(
        this.vesting.claim(someone, {
          from: user,
        }),
        'TokenVesting: account is unregistered'
      );
    });
  });

  describe('revoke', function() {
    var _account;
    var _start;
    var _cliffDuration;
    var _duration;
    var _amount;

    beforeEach(async function() {
      _account = user;
      _start = await latest();
      _cliffDuration = duration.days(5);
      _duration = duration.days(10);
      _amount = ether('1'); // 0.1M

      await this.vesting.register(
        _account,
        _start.toNumber(),
        _cliffDuration.toNumber(),
        _duration.toNumber(),
        _amount,
        true,
        { from: _ }
      );
    });

    it('normal over cliff under duration', async function() {
      await increase(duration.days('7'));
      const totalAllocatedBefore = await this.vesting.totalAllocated();
      await this.vesting.revoke(user, {
        from: _,
      });
      const totalAllocatedAfter = await this.vesting.totalAllocated();
      const userAmount = await this.vesting.amount(user);
      const userReleased = await this.vesting.released(user);
      expect(await this.vesting.revoked(user)).to.be.true;

      // remaining tokens user can claim
      expect(
        totalAllocatedBefore
          .sub(totalAllocatedAfter)
          .add(userAmount.sub(userReleased))
      ).to.be.bignumber.eq(_amount);

      // claim remaining tokens
      const block = await web3.eth.getBlock('latest');
      const userTokenBefore = await this.combo.balanceOf(user);
      await this.vesting.claim(user, {
        from: user,
      });
      const userTokenAfter = await this.combo.balanceOf(user);
      const expectClaim = _amount
        .mul(utils.toBN(block.timestamp).sub(_start))
        .div(_duration);

      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.released(user)).to.be.bignumber.eq(expectClaim);
      expect(await this.vesting.totalReleased()).to.be.bignumber.eq(
        expectClaim
      );
    });

    it('normal over duration', async function() {
      const totalAllocatedBefore = await this.vesting.totalAllocated();
      await increase(duration.days('11'));
      await this.vesting.revoke(user, {
        from: _,
      });
      const totalAllocatedAfter = await this.vesting.totalAllocated();
      expect(await this.vesting.revoked(user)).to.be.true;
      expect(await this.vesting.totalAllocated()).to.be.bignumber.eq(
        totalAllocatedBefore
      );

      // claim remaining tokens
      const userTokenBefore = await this.combo.balanceOf(user);
      await this.vesting.claim(user, { from: user });
      const userTokenAfter = await this.combo.balanceOf(user);
      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.released(user)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.totalReleased()).to.be.bignumber.eq(_amount);
    });

    it('should revert: revoke in cliff, can not claim', async function() {
      await increase(duration.days('2'));
      const totalAllocatedBefore = await this.vesting.totalAllocated();
      await this.vesting.revoke(user, {
        from: _,
      });
      const totalAllocatedAfter = await this.vesting.totalAllocated();
      expect(await this.vesting.revoked(user)).to.be.true;
      expect(await this.vesting.released(user)).to.be.zero;
      expect(await this.vesting.amount(user)).to.be.zero;
      expect(totalAllocatedBefore.sub(totalAllocatedAfter)).to.be.bignumber.eq(
        _amount
      );

      await increase(duration.days('10'));
      await expectRevert(
        this.vesting.claim(user, {
          from: user,
        }),
        'TokenVesting: no tokens are due'
      );
    });

    it('should revert: account not register', async function() {
      await expectRevert(
        this.vesting.revoke(someone, {
          from: _,
        }),
        'TokenVesting: account is unregistered'
      );
    });

    it('should revert: not onwer', async function() {
      await expectRevert(
        this.vesting.revoke(someone, {
          from: _,
        }),
        'TokenVesting: account is unregistered'
      );
    });
  });
});
