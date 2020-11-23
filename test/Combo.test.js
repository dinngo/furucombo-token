const {
  BN,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const Combo = artifacts.require('COMBO');

contract('COMBO', function([_, user, someone]) {
  before(async function() {
    this.combo = await Combo.new();
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('transfer', function() {
    it('normal', async function() {
      const totalSupply = ether('100000000'); // 100M
      expect(await this.combo.totalSupply()).to.be.bignumber.eq(totalSupply);
      expect(await this.combo.decimals()).to.be.bignumber.eq(new BN('18'));
      expect(await this.combo.symbol()).to.be.eq('COMBO');
      expect(await this.combo.name()).to.be.eq('Furucombo');
      expect(await this.combo.balanceOf.call(_)).to.be.bignumber.eq(
        totalSupply
      );

      const mintAmount = ether('1000000'); // 1M
      await this.combo.transfer(user, mintAmount, { from: _ });
      expect(await this.combo.balanceOf.call(user)).to.be.bignumber.eq(
        mintAmount
      );
    });
  });
});
