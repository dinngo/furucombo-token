const {
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
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
    await this.combo.transfer(this.vesting.address, mintAmount, { from: _ });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('register', function() {
    it('With enough balance', async function() {
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

      expect(await this.vesting.start.call(user)).to.be.bignumber.eq(_start);
      expect(await this.vesting.duration.call(user)).to.be.bignumber.eq(
        _duration
      );
      expect(await this.vesting.amount.call(user)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.released.call(user)).to.be.zero;
      expect(await this.vesting.initialized.call(user)).to.be.true;
      expect(await this.vesting.cliff.call(user)).to.be.bignumber.eq(
        _start.add(_cliffDuration)
      );
      expect(await this.vesting.totalAllocated.call()).to.be.bignumber.eq(
        _amount
      );
    });

    it('Should revert: insufficient balance', async function() {
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

    it('Should revert: account has been registered', async function() {
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

    it('Should revert: zero address', async function() {
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
        'TokenVesting: account is zero address'
      );
    });

    it('Should revert: cliff is longer than duration', async function() {
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

    it('Should revert: final time is before current time', async function() {
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
      _amount = ether('1');

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

    it('Normal over cliff under duration', async function() {
      await increase(duration.days('7'));
      const userTokenBefore = await this.combo.balanceOf(user);
      const tx = await this.vesting.claim(user, {
        from: user,
      });
      const userTokenAfter = await this.combo.balanceOf(user);

      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = _amount
        .mul(utils.toBN(block.timestamp).sub(_start))
        .div(_duration);

      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.released.call(user)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.totalReleased.call()).to.be.bignumber.eq(
        expectClaim
      );
    });

    it('Normal cliam by others', async function() {
      await increase(duration.days('7'));
      const userTokenBefore = await this.combo.balanceOf(user);
      const tx = await this.vesting.claim(user, {
        from: someone,
      });
      const userTokenAfter = await this.combo.balanceOf(user);

      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = _amount
        .mul(utils.toBN(block.timestamp).sub(_start))
        .div(_duration);

      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.released.call(user)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.totalReleased.call()).to.be.bignumber.eq(
        expectClaim
      );
    });

    it('Normal over duration', async function() {
      await increase(duration.days('11'));
      const userTokenBefore = await this.combo.balanceOf(user);
      await this.vesting.claim(user, { from: user });
      const userTokenAfter = await this.combo.balanceOf(user);
      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.released.call(user)).to.be.bignumber.eq(
        _amount
      );
      expect(await this.vesting.totalReleased.call()).to.be.bignumber.eq(
        _amount
      );
    });

    it('Normal start from before ', async function() {
      const _account = someone;
      const _start = (await latest()).sub(duration.days(9));
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

      const userTokenBefore = await this.combo.balanceOf.call(someone);
      const tx = await this.vesting.claim(someone, { from: someone });
      const userTokenAfter = await this.combo.balanceOf.call(someone);

      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = _amount
        .mul(utils.toBN(block.timestamp).sub(_start))
        .div(_duration);

      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.released.call(someone)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.totalReleased.call()).to.be.bignumber.eq(
        expectClaim
      );
    });

    it('Should revert: in cliff duration', async function() {
      await increase(duration.days('2'));
      await expectRevert(
        this.vesting.claim(user, {
          from: user,
        }),
        'TokenVesting: no tokens are due'
      );
    });

    it('Should revert: account not register', async function() {
      await expectRevert(
        this.vesting.claim(someone, {
          from: user,
        }),
        'TokenVesting: not registered'
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
      _amount = ether('1');

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

    it('Normal over cliff under duration', async function() {
      await increase(duration.days('7'));
      const totalAllocatedBefore = await this.vesting.totalAllocated.call();
      await this.vesting.revoke(user, {
        from: _,
      });
      const totalAllocatedAfter = await this.vesting.totalAllocated.call();
      const userAmount = await this.vesting.amount.call(user);
      expect(await this.vesting.revoked.call(user)).to.be.true;

      const refund = totalAllocatedBefore.sub(totalAllocatedAfter);

      // remaining tokens user can claim
      expect(_amount.sub(refund)).to.be.bignumber.eq(userAmount);

      // claim remaining tokens
      const userTokenBefore = await this.combo.balanceOf(user);
      const tx = await this.vesting.claim(user, {
        from: user,
      });
      const userTokenAfter = await this.combo.balanceOf(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = _amount
        .mul(utils.toBN(block.timestamp).sub(_start))
        .div(_duration);

      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.released.call(user)).to.be.bignumber.eq(
        expectClaim
      );
      expect(await this.vesting.totalReleased.call()).to.be.bignumber.eq(
        expectClaim
      );
    });

    it('Normal over duration', async function() {
      const totalAllocatedBefore = await this.vesting.totalAllocated.call();
      await increase(duration.days('11'));
      await this.vesting.revoke(user, {
        from: _,
      });
      const totalAllocatedAfter = await this.vesting.totalAllocated.call();
      expect(await this.vesting.revoked.call(user)).to.be.true;
      expect(totalAllocatedAfter).to.be.bignumber.eq(totalAllocatedBefore);

      // claim remaining tokens
      const userTokenBefore = await this.combo.balanceOf(user);
      await this.vesting.claim(user, { from: user });
      const userTokenAfter = await this.combo.balanceOf(user);
      expect(userTokenAfter.sub(userTokenBefore)).to.be.bignumber.eq(_amount);
      expect(await this.vesting.released.call(user)).to.be.bignumber.eq(
        _amount
      );
      expect(await this.vesting.totalReleased.call()).to.be.bignumber.eq(
        _amount
      );
    });

    it('Should revert: revoke in cliff, can not claim', async function() {
      await increase(duration.days('2'));
      const totalAllocatedBefore = await this.vesting.totalAllocated.call();
      await this.vesting.revoke(user, {
        from: _,
      });
      const totalAllocatedAfter = await this.vesting.totalAllocated.call();
      expect(await this.vesting.revoked.call(user)).to.be.true;
      expect(await this.vesting.released.call(user)).to.be.zero;
      expect(await this.vesting.amount.call(user)).to.be.zero;
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

    it('Should revert: account not register', async function() {
      await expectRevert(
        this.vesting.revoke(someone, {
          from: _,
        }),
        'TokenVesting: not registered'
      );
    });

    it('Should revert: not owner', async function() {
      await expectRevert(
        this.vesting.revoke(someone, {
          from: someone,
        }),
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert: revoked is false', async function() {
      await this.vesting.register(
        someone,
        (await latest()).toNumber(),
        duration.days(5).toNumber(),
        duration.days(10).toNumber(),
        ether('1'),
        false,
        { from: _ }
      );

      await expectRevert(
        this.vesting.revoke(someone, {
          from: _,
        }),
        'TokenVesting: cannot revoke'
      );
    });

    it('Should revert: duplicate revoke', async function() {
      await this.vesting.revoke(user, {
        from: _,
      });

      await expectRevert(
        this.vesting.revoke(user, {
          from: _,
        }),
        'TokenVesting: account already revoked'
      );
    });
  });
});
