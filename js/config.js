var config = {

	"ETH": { "address": "0x0000000000000000000000000000000000000000", "symbol": "ETH", "name": "Ether", "decimals": 18 },
	"tokens": [], //generated below, from tokens.js and online data
	"tokenMap": {}, // generated below
	"contracts": {
		"exchange": "0x1ce7ae555139c5ef5a57cc8d814a867ee6ee33d8",
		"deltabalances": "0x40a38911e470fc088beeb1a9480c2d69c847bcec"
	},
	"ABI": {
		//Ethers.js Human readable ABI, 
		"exchange": [
			"function withdraw(uint amount)",
			"function withdrawToken(address token, uint amount)",
			"function balanceOf(address token, address user) view returns (uint)",
			"event Withdraw(address token, address user, uint amount, uint balance)"
		],
		"token": [
			"function decimals() view returns (uint8)",
			"function symbol() view returns (string)",
			"function balanceOf(address owner) view returns (uint256 balance)",
			//"event Transfer(address indexed from, address indexed to, uint256 value)"
		],
		"deltabalances": [
			"function tokenBalances(address user,  address[] tokens) view returns (uint[])",
			"function depositedBalances(address exchange, address user, address[] tokens) view returns (uint[])"
		]
	},
	"balanceDecimals": 5,
	"batchLimit": 400, //max amount of tokens to batch into 1 request
	//default gas price values incase the API isn't working
	"defaultGas": {
		"slow": 1,
		"avg": 5,
		"fast": 10,
	},
	"gasLimits": {
		"default": 250000, // fallback value for gaslimit 
		"offset": 1000, // add a little buffer to a gas estimation, just in case
		"minimum": 25000, // 21k is min transfer, these are contract interactions
		"maximum": 5000000,
	},
	"ethChainId": 1, //mainnet, switching to testnet is not currently supported
	"ethPlorer": "freekey",
	"infura": "a2a41628a55842a39a19dc0abd827533",
	"etherscan": "I9E8AJSVUSNAA6HPACIBM7Z12D5TI6J5JV",
};

{
	// Generate mapping to get each token by address
	if (tokens) {
		tokens.map(token => {
			config.tokenMap[token.address.toLowerCase()] = token;
		});
		config.tokens = tokens;
	}
	if (!config.tokenMap[config.ETH.address]) {
		config.tokenMap[config.ETH.address] = config.ETH;
		config.tokens.push(config.ETH);
	}
}