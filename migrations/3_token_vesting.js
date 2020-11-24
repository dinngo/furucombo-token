const Combo = artifacts.require('COMBO');
const Vesting = artifacts.require('TokenVesting');

module.exports = function(deployer) {
  deployer
    .then(function() {
      return Combo.deployed();
    })
    .then(function(instance) {
      combo = instance;
      return deployer.deploy(Vesting, combo.address);
    });
};
