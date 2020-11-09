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
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

// const { WETH_TOKEN, WETH_PROVIDER } = require('./utils/constants');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const Combo = artifacts.require('COMBO');
// const IToken = artifacts.require('IERC20');

contract('COMBO', function([_, user, someone]) {
  before(async function() {
    this.combo = await Combo.new();
    await this.combo.addMinter(user);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('minter', function() {
    beforeEach(async function() {});

    it('normal', async function() {
      const mintAmount = ether('1000000');
      await this.combo.mint(someone, mintAmount, { from: user });
      expect(await this.combo.balanceOf.call(someone)).to.be.bignumber.eq(
        mintAmount
      );
      expect(await this.combo.totalSupply()).to.be.bignumber.eq(mintAmount);
    });

    it('should revert: not minter', async function() {
      const mintAmount = ether('1000000');
      await expectRevert(
        this.combo.mint(someone, mintAmount, { from: someone }),
        '!minter'
      );
    });
  });

  describe('mint', function() {
    beforeEach(async function() {});
    it('mint', async function() {
      const mintAmount = ether('1000000');
      await this.combo.mint(someone, mintAmount, { from: user });
      expect(await this.combo.balanceOf.call(someone)).to.be.bignumber.eq(
        mintAmount
      );
      expect(await this.combo.totalSupply()).to.be.bignumber.eq(mintAmount);
    });

    it('should revert: remove minter', async function() {
      await this.combo.removeMinter(user);
      const mintAmount = ether('1000000');
      await expectRevert(
        this.combo.mint(someone, mintAmount, { from: user }),
        '!minter'
      );
    });
  });

  describe('Governance', function() {
    beforeEach(async function() {});
    it('set governance', async function() {
      await this.combo.setGovernance(user, { from: _ });
      expect(await this.combo.governance()).to.equal(user);
    });

    it('should revert: not governance', async function() {
      await expectRevert(
        this.combo.setGovernance(user, { from: user }),
        '!governance'
      );
    });
  });

  describe('Transfer', function() {
    beforeEach(async function() {
      const mintAmount = ether('1000000');
      await this.combo.mint(user, mintAmount, { from: user });
    });

    it('transfer', async function() {
      const amount = ether('1');
      this.combo.transfer(someone, amount, { from: user });
      expect(await this.combo.balanceOf.call(someone)).to.be.bignumber.eq(
        amount
      );
    });
  });
});
