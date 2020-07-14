// config defined globally
// update...UI functions are global

"use strict";

var _W = new Withdraw();

function Withdraw() {
	let defaultConfig = {
		etherscan: config.etherscan,
		infura: config.infura,
		quorum: 2,
	}
	this.defaultProvider = ethers.getDefaultProvider(config.ethChainId, defaultConfig)  // provider for public etherscan/infura acces to ethereum
	this.clientProvider = undefined; // provider from a client like MetaMask

	this.currentAccount = undefined; //current selected wallet

	this.withdrawTransactions = [];   // array of sent transactions for all users,  [ { hash:, status: , from: ...}]

	this.ethereumEnablePending = false;
}

Withdraw.prototype.initAccount = function (address, type, signer) {

	let account = {
		"signer": undefined,
		"address": "",
		"checksumAddress": "",
		"type": undefined,
		"nonce": -1,
		"ETH": this.toBigNumber(-1),
		"walletBalances": {},
		"exchangeBalances": {},
	};

	if (address && this.isAddress(address)) {
		account.address = address.toLowerCase();
		account.checksumAddress = ethers.utils.getAddress(address);
		if (signer) {
			account.signer = signer;
		}

		if (type && (type === "metamask" || type === "key" || type === "public")) {
			account.type = type;
		}
	}
	this.currentAccount = account;

	if (type === "key") { // private key mode has no wallet that tracks nonces for us
		this.updateNonce();
	}
}

Withdraw.prototype.toBigNumber = function (num) {
	return ethers.BigNumber.from(num);
}

// check if metamask is detected, locked, unlocked  (reuslt, detected = false, unlocked = false)
Withdraw.prototype.checkMetamask = function (callback) {
	// on a hosted website
	if (location.protocol !== "https:" && location.protocol !== "http:") {
		callback("Metamask requires http(s). Use localhost instead of opening the html file.", false, false);
	}
	else if (typeof window.ethereum === "undefined" && typeof window.web3 === "undefined") {
		const text = 'No web3 client detected, install or enable <a class="alert-link" href="https://metamask.io/download.html" target="_blank" rel="noopener noreferrer">MetaMask</a>';
		callback(text, false, false);
	}
	// MetaMask or web 3 client detected
	else {
		//modern style web3 wallet (window.ethereum), requiring user unlock
		if (typeof window.ethereum !== "undefined") {

			// request permission to access wallet and possibly show a popup

			let _that = this;

			/* ethereum.enable() & .request() can respond immediately when already unlocked, or slow when the user has to react to the popup.
			 Show a help message in the slow case, detected by a timeout */
			let enableResponse = false;
			setTimeout(function () {
				if (!enableResponse) {
					if (window.ethereum.isMetaMask) {
						callback("Unlock and connect your account in the MetaMask popup.", true, false);
					} else {
						callback("Unlock or enable your Web3 wallet", true, false);
					}
				}
			}, 100);

			//avoid triggering multiple windows
			if (this.ethereumEnablePending) {
				return;
			}
			this.ethereumEnablePending = true;

			//decide to use the newest ethereum.request or the legacy ethereum.enable
			if (typeof ethereum.request === "function") {
				ethereum.request({ method: 'eth_requestAccounts' })
					.then(handleMetamaskAccounts, handleMetamaskError);
			} else {
				ethereum.enable()
					.then(handleMetamaskAccounts, handleMetamaskError);
			}

			// succes response for requesting an account from metamask
			function handleMetamaskAccounts(accounts) {
				_that.ethereumEnablePending = false;
				enableResponse = true;
				if (typeof accounts !== "undefined" && accounts.length > 0) {
					_that.clientProvider = new ethers.providers.Web3Provider(window.ethereum).getSigner();
					_that.initAccount(accounts[0], "metamask", _that.clientProvider);
					callback(accounts[0], true, true);
				} else {
					console.log("bad enable response");
				}
			}

			// failure response for requesting an account from metamask
			function handleMetamaskError(error) {
				_that.ethereumEnablePending = false;
				enableResponse = true;
				if (error && ((error.code == 4001) ||
					(typeof error == "string" && error.indexOf("denied") >= 0) ||
					(error.message && error.message.indexOf("denied") >= 0) ||
					(error.message && error.message.indexOf("rejected") >= 0))
				) {
					callback("You rejected the connection, hit the refresh button to try again.", true, false);
				} else {
					callback("Account unlock failed, hit the refresh button to try again.", true, false);
					console.log("enable request denied");
				}
			}
		} else {
			//legacy metamask style with no privacy (window.web3, no window.ethereum)
			console.log("legacy web3");

			let _that = this;
			try {
				this.clientProvider = new ethers.providers.Web3Provider(window.web3.currentProvider);
				this.clientProvider.getSigner().getAddress().then(addr => {
					_that.initAccount(addr, "metamask", _that.clientProvider.getSigner());
					callback("addr", true, true);
				}, _ => {
					callback("Failed to detect your wallet, try again.", true, false);
				});
			} catch (e) {
				callback("Failed to detect your wallet, try again.", true, false);
			}
		}
	}
};

//check if metamask (or other web3 wallet) is on the correct network
Withdraw.prototype.isNetworkCorrect = async function () {
	if (this.currentAccount && this.currentAccount.signer && this.currentAccount.signer.provider) {
		try {
			let network = await this.currentAccount.signer.provider.getNetwork();
			if (network) {
				return network.chainId == config.ethChainId;
			} else {
				throw ("Bad network response");
			}
		} catch (e) {
			throw ("Could not get network");
		};
	} else {
		throw ("No network attached to wallet");
	}
}


Withdraw.prototype.checkPrivateKey = function (keyCandidate, callback) {
	if (keyCandidate) {
		let wallet = undefined;
		try {
			wallet = new ethers.Wallet('0x' + keyCandidate);
			wallet = wallet.connect(this.defaultProvider);
		}
		catch (e) {
			callback("Invalid private key.", false);
			return;
		}

		if (wallet && wallet.address) {
			this.initAccount(wallet.address, "key", wallet);
			callback(wallet.address, true);
		}

	} else {
		callback("Empty input", false);
	}
}

Withdraw.prototype.checkPublicAddress = function (candidate, callback) {
	if (candidate) {
		if (this.isAddress(candidate)) {
			this.initAccount(candidate, "public", undefined);
			callback(candidate, true);
		} else {
			callback("Invalid address", false);
		}
	} else {
		return ("Empty input", false);
	}
}

//check if a string is a valid address
Withdraw.prototype.isAddress = function (address) {
	if (address && address.length > 0) {
		try {
			let _ = ethers.utils.getAddress(address); // exception on invalid address
			return true;
		} catch (e) { }
	}

	return false;
}

//check if we can interact & sign with the current account
Withdraw.prototype.isAccountReadOnly = function () {
	if (this.currentAccount) {
		if (this.currentAccount.type == "public" || !this.currentAccount.signer) {
			return true;
		} else {
			return false;
		}
	} else {
		return true; // no account at all?
	}
}

// load ETH balance for the current account, and update the saved values
Withdraw.prototype.updateAccountBalanceETH = function () {
	if (this.currentAccount && this.currentAccount.address) {
		let address = this.currentAccount.address;
		let _that = this;
		this.getEthBalance(address).then(balance => {
			if (_that.currentAccount && _that.currentAccount.address.toLowerCase() == address.toLowerCase()) {
				_that.currentAccount.ETH = balance;
				try {
					updateEthBalanceUI();
				} catch (e) { }
			} else {
				console.log("Received balance for different addres");
			}
		}, error => {
			console.log("failed to load ETH balance");
		});
	}
}

//get the decimals and symbol for an ERC20 token, by address
// load them from their contract if we don't know it
Withdraw.prototype.getTokenDetails = async function (address) {
	if (this.isAddress(address)) {
		address = address.toLowerCase();
		//we already know that token
		if (config.tokenMap[address]) {
			return config.tokenMap[address];
		}

		let tokenContract = new ethers.Contract(address, config.ABI.token, this.defaultProvider);

		//get decimals and then symbol
		let decimals = undefined;
		try {
			decimals = await tokenContract.decimals();
			let symbol = undefined;
			try {
				symbol = await tokenContract.symbol();
			} catch (e) { }
			if (symbol) {
				let s = JSON.stringify(symbol.trim()); // TODO handle cleaning on output?
				s = s.slice(1, s.length - 1); //remove quatation "" made by stringify
				if (s === "") {
					s = "???";
				}
				let token = { address: address, symbol: s, decimals: decimals };
				return token;
			} else {
				let token = { address: address, symbol: "???", decimals: decimals };
				return token;
			}
		} catch (_) {
			throw ("Failed to load token details");
		}
	} else {
		throw ("Failed to load token details");
	}
}

// query which tokens are in the exchange contract, only these might be deposited tokens
Withdraw.prototype.updateExchangeTokens = async function () {
	const address = config.contracts.exchange;
	const url = "https://api.ethplorer.io/getAddressInfo/" + address + "?apiKey=" + config.ethPlorer;

	return ethers.utils.fetchJson({ url: url }).then(json => {
		if (json && json.tokens) {
			let tokens = json.tokens.map(token => {
				let symbol = token.tokenInfo.symbol;
				if (symbol === "") {
					if (token.tokenInfo.name && token.tokenInfo.name.length < 10) { //substitute name for empty symbol
						symbol = token.tokenInfo.name;
					} else {
						symbol = "???"
					}
				}
				return {
					address: token.tokenInfo.address.toLowerCase(),
					symbol: symbol.trim(), // TODO more cleaning
					decimals: Number(token.tokenInfo.decimals),
				}
			});
			tokens = tokens.filter(token => {
				return !config.tokenMap[token.address];
			});

			//add unknown tokens
			tokens.forEach(token => {
				config.tokenMap[token.address] = token;
			});
			config.tokens = Object.values(config.tokenMap);
			//TODO store unknown tokens in browser cache?

			return true;
		}
	}, _ => {
		console.log("Failed to load token list");
		return false;
	}).catch(_ => {
		console.log("Failed to load token list");
		return false;
	});

}

// get the ETH balance of an address
Withdraw.prototype.getEthBalance = async function (address) {
	if (this.isAddress(address) && this.defaultProvider) {
		return this.defaultProvider.getBalance(address).then((balance) => {
			return balance;
		}, (e) => {
			throw (e);
		});
	} else {
		throw ("invalid input parameters");
	}
}

//update the nonce of the current account, only increase or set it.
Withdraw.prototype.increaseNonce = function (address, nonce) {
	if (address && this.currentAccount && this.currentAccount.address.toLowerCase() === address.toLowerCase()) {
		// only set if no nonce known yet, or nonce is lower
		if (!this.currentAccount.nonce || this.currentAccount.nonce < nonce) {
			this.currentAccount.nonce = nonce;
			try {
				//save this nonce value in the cache to handle pending transactions on a page reload
				localStorage.setItem("nonce-" + address.toLowerCase(), nonce);
			} catch (e) { }
		}
		updateNonceUI();
	}
}

//try to update the nonce of the current account
Withdraw.prototype.updateNonce = function () {
	if (this.accountNeedsNonce()) {
		let _that = this;
		let address = this.currentAccount.address.toLocaleLowerCase();
		let cachedNonce = -1;

		try {
			//check if we have a nonce saved in the browser cache
			let nonceString = localStorage.getItem("nonce-" + address);
			nonceString = JSON.stringify(nonceString).replace(/[^0-9]/gi, ""); //make sure it is numbers only
			if (nonceString) {
				cachedNonce = Number(nonceString);
			}
		} catch (e) { }
		//load the cached one first
		_that.increaseNonce(address, cachedNonce);
		//check for a new (higher) one
		this.getNonce(address).then(nonce => {
			_that.increaseNonce(address, nonce);
		}, error => {
		});
	}
}

// get the nonce of the last known tx, next tx gets nonce+1
Withdraw.prototype.getNonce = async function (address) {
	return this.defaultProvider.getTransactionCount(address).then((transactionCount) => {
		let nonce = transactionCount - 1;
		return nonce;
	}, _ => {
		throw ("failed to get nonce");
	});
};

// check if the account type needs to keep track of the nonce
Withdraw.prototype.accountNeedsNonce = function () {
	if (this.currentAccount && this.currentAccount.type === "key" && this.currentAccount.signer) {
		return true;
	}
	return false;
}

//get transaction data from a hash
Withdraw.prototype.getTransaction = async function (hash) {
	if (!hash) {
		throw ("No transaction hash");
	}

	return this.defaultProvider.getTransaction(hash).then((transaction) => {
		if (transaction) {
			return transaction;
		} else {
			throw ("Transaction not found");
		}
	}, _ => {
		throw ("getTransaction failed");
	});
};

//get transaction receipt from a hash
Withdraw.prototype.getTransactionReceipt = async function (hash) {
	if (!hash) {
		throw ("No transaction hash");
	}
	let receipt = undefined;
	try {
		receipt = await this.defaultProvider.getTransactionReceipt(hash);
		if (receipt) {
			return receipt;
		} else {
			throw ("error"); // go to catch
		}
	} catch (_) {
		throw ("Receipt not found or failed");
	}
}


// get an estimate for gas prices in the current mainnet (slow, standard and fast gas prices) 
Withdraw.prototype.getGasPrices = async function () {
	let json = undefined;
	let prices = undefined;
	try {
		json = await ethers.utils.fetchJson({ url: "https://www.etherchain.org/api/gasPriceOracle" });
		if (json) {
			prices = {
				low: Math.ceil(Number(json.safeLow)),
				avg: Math.ceil(Number(json.standard)),
				fast: Math.ceil(Number(json.fast)),
				time: Date.now()
			};
		}
	} catch (_) {
		try {
			json = await ethers.utils.fetchJson({ url: "https://ethgasstation.info/api/ethgasAPI.json" });
			if (json) {
				//ethgaststation returns numbers *10
				prices = {
					low: Math.ceil(Number(json.safeLow) / 10.0),
					avg: Math.ceil(Number(json.average) / 10.0),
					fast: Math.ceil(Number(json.fast) / 10.0),
					time: Date.now()
				};
			}
		} catch (e) { }
	}

	if (prices) {
		if (prices.low == prices.avg) {
			prices.avg = prices.avg + 1;
		}
		if (prices.avg == prices.fast) {
			prices.fast = prices.fast + 1;
		}
		config.lastGasPrices = prices;
		return prices;
	} else {
		throw ("failed updating gas prices");
	}
}

// make an etherscan url from an address
Withdraw.prototype.etherscanAddressUrl = function (address) {
	let url = "https://etherscan.io/address/";
	if (address) {
		try {
			address = ethers.utils.getAddress(address); //make checksum address
			return url + address;
		} catch (e) { }
	} else {
		return url;
	}
};

// make an etherscan url from a transaction hash
Withdraw.prototype.etherscanHashUrl = function (hash) {
	let url = "https://etherscan.io/tx/";
	if (hash) {
		return url + hash;
	} else {
		return url;
	}
};

// make an etherscan url from a token address
Withdraw.prototype.etherscanTokenUrl = function (token) {
	let url = "https://etherscan.io/token/";
	if (token && token.address) {
		return url + token.address;
	} else {
		return url;
	}
};


//get the token balances for an array of tokens [tokenadress] and a wallet address 
// ETH is handled exactly like a token here
Withdraw.prototype.getWalletBalances = async function (tokenAddrs, walletAddress) {
	return this.getBatchBalances("tokenBalances", tokenAddrs, walletAddress);
}

//get the exchange token balances for an array of tokens [tokenadress] and a wallet address 
Withdraw.prototype.getExchangeBalances = async function (tokenAddrs, walletAddress) {
	return this.getBatchBalances("depositedBalances", tokenAddrs, walletAddress);
}

//get a batch of balances for a functoin, set of tokens [tokenadress] and a wallet address 
// currently supports only 2 functions "depositedBalances" and "walletBalances"
Withdraw.prototype.getBatchBalances = async function (functionName, tokenAddrs, walletAddress) {

	if (tokenAddrs.length == 0) {
		throw ("bad input, empty array");
	} else if (!functionName) {
		throw ("bad functionName param");
	}

	//read only contract instance
	const batchContract = new ethers.Contract(config.contracts.deltabalances, config.ABI.deltabalances, this.defaultProvider);

	if (!batchContract[functionName]) {
		throw ("bad function in batchContract instance");
	}

	let tokenCount = tokenAddrs.length;

	let balances = {};
	tokenAddrs.map((address) => {
		balances[address] = this.toBigNumber(-1);
	});

	let balancePromises = [];
	if (tokenAddrs.length < config.batchLimit) {
		balancePromises = [queryBalances(tokenAddrs, walletAddress)];
	} else {
		//split the list into multiple smaller batches
		let iterations = Math.ceil(tokenAddrs.length / Number(config.batchLimit));
		let batchSize = Math.ceil(tokenAddrs.length / iterations);
		for (let i = 0; i < tokenCount; i += batchSize) {
			let tokenList = tokenAddrs.slice(i, i + batchSize);
			let promise = queryBalances(tokenList, walletAddress)
			balancePromises.push(promise);
		}
	}

	try {
		await Promise.all(balancePromises);
	} catch (_) { }
	return balances;

	async function queryBalances(tokens, wallet) {
		let queryPromise = undefined;
		try {
			if (functionName === "tokenBalances") {
				queryPromise = batchContract[functionName](wallet, tokens);
			} else { // "depositedBalances"
				queryPromise = batchContract[functionName](config.contracts.exchange, wallet, tokens);
			}

			let result = await queryPromise;
			if (result && result.length == tokens.length) {
				tokens.forEach((address, index) => {
					let value = result[index];
					balances[address] = value;
				});
			} else {
				throw ("Bad length of " + functionName + " response");
			}
		} catch (e) {
			if (e && e.message) {
				console.log(e.message);
			} else {
				console.log(e);
			}
		}
	}
}


// convert token value from wei (bignumber) to normal units (string)
Withdraw.prototype.weiToUnit = function (weiValue, token) {
	if (!token)
		token = config.ETH; // ETH, 18 decimals

	let value = ethers.utils.formatUnits(weiValue, token.decimals);
	if (token.decimals == 0 || value == "0.0") {
		value = value.replace(".0", "");
	}
	return value;
};

// convert token value from normal units (string) to wei (bignumber)
Withdraw.prototype.unitToWei = function (value, token) {
	if (!token)
		token = config.ETH; // ETH, 18 decimals
	value = String(value);
	if (token.decimals == 0 || value == "0.0") {
		value = value.replace(".0", "");
	}
	return ethers.utils.parseUnits(value, token.decimals);
};

// weiToUnit() but with a round/padding to a fixed number of decimals
Withdraw.prototype.weiToDisplayUnit = function (weiValue, token) {
	let value = this.weiToUnit(weiValue, token);
	let numberOfDecimals = config.balanceDecimals;

	let split = value.split(".");
	let decimalPart = split[1];
	//numbers with more decimals get rounded down
	if (decimalPart.length > numberOfDecimals) {
		decimalPart = decimalPart.slice(0, numberOfDecimals + 1); //1 digit too much
		let newDec = Math.round(Number(decimalPart) / 10);
		decimalPart = newDec.toString();
	}

	// pad numbers with not enough decimals
	while (decimalPart.length < numberOfDecimals) {
		decimalPart += "0";
	}

	return split[0] + "." + decimalPart;
}


// send a transaction to perform an ETH or token withdraw
Withdraw.prototype.sendWithdraw = async function (token, amount, gasPrice, gasLimit) {
	if (this.currentAccount && this.currentAccount.signer) {

		// tx overrides, limit & price will override the ones metamask would provide by default
		let txOverrides = {
			gasLimit: gasLimit,
			gasPrice: gasPrice,
		};
		//ignore nonce for metamask, and if we failed to load one, let ether.js figure out the nonce
		if (this.currentAccount.type !== "metamask" && this.currentAccount.nonce > -1) {
			txOverrides.nonce = this.currentAccount.nonce + 1  //ignored by metamask?
		}

		let sender = this.currentAccount.address.toLowerCase();
		let _that = this;
		//contract instance with write permissions using signer
		let exchange = new ethers.Contract(config.contracts.exchange, config.ABI.exchange, this.currentAccount.signer);

		if (token.address.toLowerCase() !== config.ETH.address.toLowerCase()) {

			return exchange.withdrawToken(token.address, amount, txOverrides).then(tx => {
				_that.increaseNonce(sender, tx.nonce);
				return tx;
			}, error => {
				let eResponse = parseSendErrors(error);
				throw (eResponse);
			});

		} else {
			return exchange.withdraw(amount, txOverrides).then(tx => {
				_that.increaseNonce(sender, tx.nonce);
				return tx;
			}, error => {
				let eResponse = parseSendErrors(error);
				throw (eResponse);
			});
		}
	} else {
		console.log("Attempted withdraw without the ability to sign.");
		throw ("Not signed");
	}

	//return a short status string based on the error message
	function parseSendErrors(error) {

		if (error && error.message && error.code) {
			try {
				console.log(error.message);
				error.message = error.message.toLowerCase();
				if (error.message.indexOf("nonce") >= 0) {
					return "Rejected - Nonce";
				} else if (error.message.indexOf("gas") >= 0 || error.message.indexOf("cost") >= 0 || error.message.indexOf("always failing") >= 0 || error.message.indexOf("execution") >= 0) {
					return "Rejected - Failed";
				} else if (error.message.indexOf("funds") >= 0) {
					return "Rejected - Funds";
				}
				else if (error.code == 4001 || error.message.indexOf("denied") >= 0 || error.message.indexOf("user") >= 0) {
					return "Rejected by user";
				} else {
					return "Sending failed";
				}
			} catch (e) {
				return "Sending failed";
			}
		} else {
			return "Sending failed";
		}
		/*
		{code: -32000, message: "gas required exceeds allowance (9995066) or always failing transaction"}
		{code: 4001, message: "MetaMask Tx Signature: User denied transaction signature.", stack: "Error: MetaMask Tx Signature: User denied transaction signature."}
		 {"code":-32000,"message":"nonce too low"}
		code -32010 Transaction nonce is too low
		*/
	}
}

//estimate the gas limit for a (token) withdraw
// used to test if a transaction will fail before trying to send it
Withdraw.prototype.withdrawEstimate = async function (token, amount) {

	let transaction = {
		from: this.currentAccount.address,
		to: config.contracts.exchange,
		value: 0,
		data: "0x",
		chainId: config.ethChainId
	};
	//encode the withdraw function into tx.data
	let txData = this.encodeWithdraw(token, amount);
	transaction.data = txData;

	let gasLimit = undefined;
	// estimate the
	try {
		gasLimit = await this.defaultProvider.estimateGas(transaction);
	} catch (error) {
		if ((error && error.code == -3200) || (error.message && (error.message.indexOf("exceeds allowance") >= 0 || error.message.indexOf("always failing") >= 0))) {
			return { limit: undefined, willFail: true };
		} else {
			return { limit: undefined, willFail: false };
		}
		/* example error when estimating a failing tx
	 code -3200, message "Error: gas required exceeds allowance (10000000) or always failing transaction at ...."  */
	}
	return { limit: Number(gasLimit), willFail: false };
}

// encode a withdraw to return tx.data, the data parameter of a transaction
// auto-generated when sending a transaction using ethers, but not when estimating gas limits
Withdraw.prototype.encodeWithdraw = function (token, amount) {
	let callData = "";
	if (token && token.address && amount) {
		let iface = new ethers.utils.Interface(config.ABI.exchange);
		let value = amount;
		if (token.address.toLowerCase() == config.ETH.address.toLowerCase()) {
			callData = iface.encodeFunctionData("withdraw", [value]);
		} else {
			callData = iface.encodeFunctionData("withdrawToken", [token.address, value]);
		}
	} else {
		console.log("encoding invalid withdraw");
	}
	return callData;
}

// get the first withdraw event from an array of logs
Withdraw.prototype.getWithdrawFromLogs = function (logs) {

	if (logs) {
		let iface = new ethers.utils.Interface(config.ABI.exchange);
		for (let i = 0; i < logs.length; i++) {
			try {
				let decoded = iface.parseLog(logs[i]);

				if (decoded && decoded.name == "Withdraw") {
					let tokenAddr = decoded.args.token.toLowerCase();
					let token = config.tokenMap[tokenAddr];
					if (token) {
						let amount = decoded.args.amount;
						let balance = decoded.args.balance;
						let user = decoded.args.user.toLowerCase();

						return { token: token, user: user, amount: amount, exchangeBalance: balance };
					}
				}
			} catch (e) { }
		}
	}
	return undefined;
}
