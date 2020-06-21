//config defined globally
// _W for Witdraw.js defined globally

"use strict";


// default gas values if api doesn't load
let gasLow = config.defaultGas.slow,
	gasAvg = config.defaultGas.avg,
	gasFast = config.defaultGas.fast;

//internal state variables
let setDatatables = false;
let pendingTx = false;
let selectedIndex = -1;
let unlocked = false;
let currentWithdrawToken = undefined;  //token for current withdraw modal
let currentAdditionToken = undefined; //state for addToken modal
let modalId = 1;



$(document).ready(function () {
	setupDatatables();

	//handle metamask events like account change or network change
	if (window.ethereum) {
		handleMetamaskEvents();
	}

	// if a modal gets hidden, update id to ignore (slow) requests sent from an old modal
	$("#withdrawModal").on("hidden.bs.modal", function () {
		modalId++;
	});
	$("#addTokenModal").on("hidden.bs.modal", function () {
		modalId++;
	});

});// ready



// initialize tables with DataTables, to enable pagination/sorting
function setupDatatables() {
	if (setDatatables)
		return;

	setDatatables = true;

	$("#balancesTable").DataTable({
		"sDom": '<"row view-filter"<"col-sm-12"<"pull-left"l><"pull-right"f><"clearfix">>>t<"row view-pager"<"col-sm-12"<"text-center"p>>>',
		"info": false,
		"scrollX": true,
		"order": [[1, "desc"]],
		"lengthMenu": [[5, 10, 25, 50, 100], [5, 10, 25, 50, 100]],
		"language": {
			"lengthMenu": "Show _MENU_",
			"zeroRecords": "No deposited tokens found",
			"paginate": {
				"previous": "<",
				"next": ">"
			}
		},
		"columnDefs": [{
			"targets": 2,
			"orderable": false,
			"searchable": false,
			"className": "text-center",
		}, {
			"targets": [1, 3],
			"searchable": false,
			"className": "text-right",
			"render": $.fn.dataTable.render.number(",", ".", config.balanceDecimals)  // round numbers to a certain amount of decimals
		}]
	});

	$("#withdrawsTable").DataTable({
		"sDom": '<"row view-filter"<"col-sm-12"<"pull-left"l><"pull-right"f><"clearfix">>>t<"row view-pager"<"col-sm-12"<"text-center"p>>>',
		"info": false,
		"scrollX": true,
		"order": [[4, "desc"]],
		"lengthMenu": [[5, 10, 25], [5, 10, 25]],
		"language": {
			"lengthMenu": "Show _MENU_",
			"zeroRecords": "No withdrawals sent",
			"paginate": {
				"previous": "<",
				"next": ">"
			}
		},
		"columnDefs": [{
			"targets": [1],
			"searchable": false,
			"className": "text-right",
			"render": $.fn.dataTable.render.number(",", ".", config.balanceDecimals)
		}]
	});
}

//////////////////////////////////////////////
//	wallet unlock state

// select metamask wallet
function loadMetamask(noTrigger = false) {
	selectedIndex = 1;
	_W.currentAccount = {};

	$("#walletResultTitle").text("Metamask (web3)");
	hide(".walletResult", true);
	hide("#metamaskWallet", false);
	hide("#metamaskWarning", true);
	$("#metamaskContents").text("");

	$("#refreshWalletResult").attr("onclick", "loadMetamask()");
	hide("#refreshWalletResult", true);
	$("#refreshWalletResult").attr("disabled", true);

	$("#enableWeb3").addClass("hidden");
	$("#enableWeb3").attr("disabled", true);

	$("#continueWallet").addClass("hidden");
	$("#continueWallet").attr("disabled", true);

	scrollToWalletResult();

	//triggered change on logout, don"t trigger the popup form checkMetamask
	if (noTrigger) {
		//metamask refresh button
		$("#refreshWalletResult").removeClass("hidden");
		$("#refreshWalletResult").attr("disabled", false);
		hide("#metamaskAddress", true);
		$("#metamaskWarning").text("Logged out, hit the refresh button to connect again.");
		hide("#metamaskWarning", false);
		return;
	}

	//try to get an address from metamask (login -> unlock -> request address)
	_W.checkMetamask((text, detected, unlocked) => {
		//metamask refresh button
		$("#refreshWalletResult").removeClass("hidden");
		$("#refreshWalletResult").attr("disabled", false);

		if (unlocked) {

			_W.isNetworkCorrect().then(correct => {
				if (correct) {
					_W.updateAccountBalanceETH();
					hide("#metamaskWarning", true);
					hide("#metamaskAddress", false);

					$("#metamaskContents").text(("Use a different address? Change it in your wallet and hit the refresh button."));
					//display detected wallet
					$("#metamaskAddress").html($("<a />", { text: text, href: _W.etherscanAddressUrl(text), target: "_blank", rel: "noopener noreferrer" }));

					//continue button
					$("#continueWallet").removeClass("hidden");
					$("#continueWallet").attr("disabled", false);
				} else {
					hide("#metamaskWarning", false);
					if (config.ethChainId == 1) {
						$("#metamaskWarning").text("Your wallet is on a test network, switch to the main network.");
					} else {
						$("#metamaskWarning").text("Your wallet is on the wrong network.");
					}
					// show locked/ not detected
					hideContinue("#metamaskAddress");
				}
			}, e => {
				console.log(e);
				hide("#metamaskWarning", false);
				$("#metamaskWarning").text("Failed to identify your wallet's network configuration, try again.");
				// show locked/ not detected
				hideContinue("#metamaskAddress");
			});

		} else {
			hide("#metamaskWarning", false);
			$("#metamaskWarning").html(text);
			// show locked/ not detected
			hideContinue("#metamaskAddress");
		}
	});
}

//select public address
function loadPublic() {
	_W.currentAccount = {};
	selectedIndex = 0;

	$("#walletResultTitle").text("Ethereum Address");
	hide(".walletResult", true);
	$("#refreshWalletResult").attr("disabled", true);
	$("#refreshWalletResult").addClass("hidden");
	hide("#publicWallet", false);

	$("#continueWallet").addClass("hidden");
	$("#continueWallet").attr("disabled", true);

	checkAddressInput($("#addressInput").val());
	scrollToWalletResult();
}

//select private key option
function loadKey() {
	_W.currentAccount = {};
	selectedIndex = 2;

	$("#walletResultTitle").text("Private Key");
	hide(".walletResult", true);
	$("#refreshWalletResult").attr("disabled", true);
	$("#refreshWalletResult").addClass("hidden");
	hide("#privateWallet", false);

	$("#continueWallet").addClass("hidden");
	$("#continueWallet").attr("disabled", true);

	checkKeyInput($("#keyInput").val());
	scrollToWalletResult();
}

function showHideKey() {
	let type = $("#keyInput").prop("type");
	if (type == "text") {
		$("#keyInput").prop("type", "password");
		$("#keyToggleIcon").addClass("fa-eye");
		$("#keyToggleIcon").removeClass("fa-eye-slash");
	} else {
		$("#keyInput").prop("type", "text");
		$("#keyToggleIcon").removeClass("fa-eye");
		$("#keyToggleIcon").addClass("fa-eye-slash");
	}
}

function checkKeyInput(string, showError) {
	if (string) {
		//remove non alphanumeric characters
		let cleanedString = JSON.stringify(string).replace(/[^0-9a-z]/gi, "");
		if (cleanedString !== string) {
			$("#keyInput").val(cleanedString);
		}

		$("#keyError").text("");
		if (showError) {
			$("#keyError").removeClass("hidden");
		} else {
			$("#keyError").addClass("hidden");
		}

		// key should be 64
		if (cleanedString.length == 64 || (cleanedString.length == 66 && cleanedString.slice(0, 2) == "0x")) {
			_W.checkPrivateKey(cleanedString, (text, valid) => {
				if (valid) {

					_W.updateAccountBalanceETH();

					//display detected wallet
					$("#keyAddress").html($("<a />", { text: text, href: _W.etherscanAddressUrl(text), target: "_blank", rel: "noopener noreferrer" }));
					$("#keyAddress").removeClass("hidden");

					$("#keyError").addClass("hidden");

					//continue button
					$("#continueWallet").removeClass("hidden");
					$("#continueWallet").attr("disabled", false);
				} else {
					$("#keyError").text("This is an invalid private key, it does not generate an address.");
					hideContinue("#keyAddress");
				}
			});
		} else if (cleanedString.length < 64 && cleanedString.length > 0) {
			if (cleanedString.length == 42 && string.slice(0, 2) == "0x") {
				$("#keyError").text("This is a public address, not a private key. ");
			} else {
				$("#keyError").text("Key is too short, only " + cleanedString.length + " of 64 characters.");
			}

			hideContinue("#keyAddress");
		} else if (cleanedString.length > 64) {
			$("#keyError").text("Key is too long, " + cleanedString.length + " of 64 characters.");
			hideContinue("#keyAddress");
		}
	} else {
		$("#keyError").addClass("hidden");
		hideContinue("#keyAddress");
	}
}

//scroll to wallet result div on mobile devices where it is verticaly stacked
function scrollToWalletResult() {
	if ($("#mobileTest").is(":hidden")) {
		$([document.documentElement, document.body]).animate({
			scrollTop: $("#walletResultTitle").offset().top
		}, "fast");
	}
}

function checkAddressInput(string, showError) {
	if (string) {
		//remove non alphanumeric characters
		let cleanedString = JSON.stringify(string).replace(/[^0-9a-z]/gi, "");
		if (cleanedString !== string) {
			$("#addressInput").val(cleanedString);
		}

		$("#addressError").text("");
		if (showError) {
			$("#addressError").removeClass("hidden");
		} else {
			$("#addressError").addClass("hidden");
		}

		// Address should be 42 characters in length, including "0x"
		if (cleanedString.length == 42) {
			if (cleanedString.slice(0, 2).toLowerCase() == "0x") {
				_W.checkPublicAddress(cleanedString, (text, valid) => {
					if (valid) {
						_W.updateAccountBalanceETH();

						//display detected wallet
						$("#publicAddress").html($("<a />", { text: text, href: _W.etherscanAddressUrl(text), target: "_blank", rel: "noopener noreferrer" }));
						$("#publicAddress").removeClass("hidden");

						$("#addressError").addClass("hidden");

						//continue button
						$("#continueWallet").removeClass("hidden");
						$("#continueWallet").attr("disabled", false);
					} else {
						$("#addressError").text("This is an invalid ethereum address.");
						hideContinue("#publicAddress");
					}
				});
			} else {
				$("#addressError").text("An address should start with '0x'");
			}
		} else if (cleanedString.length < 42 && cleanedString.length > 0) {
			$("#addressError").text("Address is too short, only " + cleanedString.length + " of 42 characters.");
			hideContinue("#publicAddress");
		} else if (cleanedString.length > 42) {
			if (cleanedString.length == 64) {
				$("#addressError").text("Address is too long, did you enter a Private Key?");
			} else {
				$("#addressError").text("Address is too long, " + cleanedString.length + " of 42 characters.");
				hideContinue("#publicAddress");
			}
		}
	} else {
		$("#addressError").addClass("hidden");
		hideContinue("#publicAddress");
	}

}

//hide the wallet select continue button and possibly a detected address
function hideContinue(addressId = undefined) {
	//continue button
	$("#continueWallet").addClass("hidden");
	$("#continueWallet").attr("disabled", true);
	if (addressId) {
		$(addressId).addClass("hidden");
	}
}

// continue from wallet unlock to balance checking
function finishUnlock() {
	if (_W.currentAccount && _W.currentAccount.address) {

		unlocked = true;

		//do we have a wallet that can interact?
		if (_W.currentAccount.type !== "public") {
			loadGasPrices();
		}

		//switch visible divs
		hide(".firstPage", true);
		hide(".secondPage", false);

		let addr = _W.currentAccount.checksumAddress;
		$("#selectedWalletAddress").html($("<a />", { text: addr, href: _W.etherscanAddressUrl(addr), target: "_blank", rel: "noopener noreferrer" }));
		let adressIcon = "url(" + blockies.makeBlockie(_W.currentAccount.address.toLowerCase());
		document.getElementById("addressImage").style.backgroundImage = adressIcon;

		updateEthBalanceUI();
		updateNonceUI();

		if (_W.isAccountReadOnly()) {
			hide(".readOnlyError", false);
			$("#withdrawConfirm").attr("onclick", "");
			$("#withdrawConfirm2").attr("onclick", "");
		} else {
			hide(".readOnlyError", true);
			$("#withdrawConfirm").attr("onclick", "confirmWithdraw()");
			$("#withdrawConfirm2").attr("onclick", "performWithdraw()");
		}

		//start loading balances table
		fillBalanceTable();
		reloadWithdrawsTable(true);

		$(window).scrollTop(0); //scroll to top for mobile devices & small windows
	}
}

//go back to wallet selection
function resetWallet() {

	$("#balancesTable").dataTable().api().clear().draw();
	$("#withdrawstable").dataTable().api().clear().draw();

	unlocked = false;
	hide(".firstPage", false);
	hide(".secondPage", true);

	hide("#ethWalletSpinner", false);
	hide("#ethwalletbalance", true);

	$(window).scrollTop(0); //scroll to top for mobile devices & small windows
}

// wrapper for jquery addClass removeClass "hidden"
function hide(id, hide) {
	if (id && typeof id == "string") {
		if (id[0] === "#") {
			if (hide) {
				$(id).addClass("hidden");
			} else {
				$(id).removeClass("hidden");
			}
		} else if (id[0] === ".") {
			if (hide) {
				$(id).each(function () {
					$(this).addClass("hidden");
				});
			} else {
				$(id).each(function () {
					$(this).removeClass("hidden");
				});
			}
		}
	}
}


function updateEthBalanceUI() {
	if (_W.currentAccount.ETH) {

		hide("#ethWalletSpinner", true);
		hide("#ethwalletbalance", false);

		// update ETH balance on page,  -1 means a loading failure
		if (_W.currentAccount.ETH.lt(0)) {
			$("#ethwalletbalance").text("Failed to load");
		} else {
			$("#ethwalletbalance").text(_W.weiToUnit(_W.currentAccount.ETH));
		}

		// show gas error for balance <= 0
		if (_W.currentAccount.ETH.lte(0)) {
			hide("#ethBalanceError", false);
		} else {
			hide("#ethBalanceError", true);
		}
	}
}

function updateNonceUI() {
	hide("#nonce", true);
	if (_W.accountNeedsNonce()) {
		$("#nonce").text("nonce: " + _W.currentAccount.nonce);
		hide("#nonce", false);
	}
}

// load gas prices or show a warning on failure
function loadGasPrices() {

	_W.getGasPrices().then(prices => {
		if (prices) {
			gasLow = prices.low;
			gasAvg = prices.avg;
			gasFast = prices.fast;
			hide("#gasPriceWarning", true);
		}
	}, _ => {
		//if we did not load gas prices this session, show a warning
		if (!config.lastGasPrices) {
			hide("#gasPriceWarning", false);
		}
	});
}

//////////////////////////////////////////////
//	balanceCheck state

//get all balances and show them in the table
function fillBalanceTable() {

	//data tables variables
	$("#balancesTable").dataTable().api().clear();

	$("#balancesRefreshButton").attr("disabled", true);
	$("#balancesRefreshIcon").addClass("fa-spin");
	hide("#balanceLoadSpinner", false);
	hide("#balanceLoadError", true);

	_W.currentAccount.walletBalances = {};
	_W.currentAccount.exchangeBalances = {};
	let walletAddress = _W.currentAccount.address;
	let tokenAddrs = config.tokens.map(x => x.address);


	// get balances in the exchange
	_W.getExchangeBalances(tokenAddrs, walletAddress).then(exchangeResult => {
		_W.currentAccount.exchangeBalances = exchangeResult;
		drawBalancesTable();

		//if balances contain a value < 0, some failed to load
		let failedExBalance = Object.values(exchangeResult).find(value => value.lt(0));

		//only get wallet balances for tokens that have a positive deposited balance (or failed to load), expect always load ETH
		let depositedTokens = Object.keys(exchangeResult).filter(address => {
			return address === config.ETH.address || exchangeResult[address].gt(0);
		});

		if (depositedTokens.length > 0) {
			//get balances in wallet
			_W.getWalletBalances(depositedTokens, walletAddress).then(walletResult => {
				_W.currentAccount.walletBalances = walletResult;

				//if balances contain a value < 0, some failed to load
				let failedWalletBalance = Object.values(walletResult).find(value => value.lt(0));

				//try to update wallet balance for ETH
				if (walletResult.hasOwnProperty(config.ETH.address) && walletResult[config.ETH.address].gte(0)) {
					_W.currentAccount.ETH = walletResult[config.ETH.address];
					updateEthBalanceUI();
				}

				finishBalanceUI((failedExBalance || failedWalletBalance));
			}, error => {
				finishBalanceUI(true);
			});
		} else {
			finishBalanceUI(failedExBalance);
		}
	}, error => {
		finishBalanceUI(true);
	});

	function finishBalanceUI(error = false) {
		hide("#balanceLoadError", !error);
		drawBalancesTable();
		$("#balancesRefreshButton").attr("disabled", false);
		$("#balancesRefreshIcon").removeClass("fa-spin");
		hide("#balanceLoadSpinner", true);
	}

}

function drawBalancesTable() {
	if (!setupDatatables) {
		console.log('balances table not initialized');
		return;
	}
	let dt = $("#balancesTable").dataTable().api();
	dt.clear();
	let currentAccount = _W.currentAccount;

	// filter out tokens where the deposited balance is 0
	let balanceTokens = [];
	if (currentAccount.exchangeBalances) {
		balanceTokens = Object.keys(currentAccount.exchangeBalances).filter(address => {
			return currentAccount.exchangeBalances[address].gt(0) || currentAccount.exchangeBalances[address].lt(0); // keep -1 values to show a loading error
		});
	}
	balanceTokens = balanceTokens.map(address => {
		return config.tokenMap[address];
	});

	let loadErrors = false;
	// fill the balances table
	for (let i = 0; i < balanceTokens.length; ++i) {
		const token = balanceTokens[i];

		let walletBalance = "-";
		if (currentAccount.walletBalances && currentAccount.walletBalances.hasOwnProperty(token.address)) {
			walletBalance = currentAccount.walletBalances[token.address];
			if (walletBalance.lt(0)) {
				walletBalance = "-";
				loadErrors = true;
			} else {
				walletBalance = _W.weiToUnit(walletBalance, token);
			}
		}

		let exchangeBalance = "-";
		if (currentAccount.exchangeBalances && currentAccount.exchangeBalances.hasOwnProperty(token.address)) {
			exchangeBalance = currentAccount.exchangeBalances[token.address];
			if (exchangeBalance.lt(0)) {
				exchangeBalance = "-";
				loadErrors = true;
			} else {
				exchangeBalance = _W.weiToUnit(exchangeBalance, token);
			}
		}

		if (loadErrors) {
			hide("#balanceLoadError", false);
		}

		let disabledButton = "";
		if (exchangeBalance === "-") {
			disabledButton = 'disabled';
		} else {
			disabledButton = 'onclick="showWithdraw(\'' + token.address.toLowerCase() + '\')"';
		}
		let buttonDisplay = '<button class="withdrawButton btn btn-primary btn-sm" ' + disabledButton + ' ><i class="fa fa-arrow-right" style="font-size:15px"></i></button>';

		dt.row.add([getTokenLink(token), exchangeBalance, buttonDisplay, walletBalance]);
	}
	dt.draw();
}


function getTokenLink(token) {
	if (token.address == config.ETH.address) {
		return "ETH";
	} else {
		let anchor = $("<a />", { text: token.symbol, href: _W.etherscanAddressUrl(token.address), target: "_blank", rel: "noopener noreferrer" });
		return anchor[0].outerHTML;
	}
}

function getHashLink(hash) {
	if (hash) {
		if (hash.length > 1) {
			let anchor = $("<a />", { text: hash.slice(0, 5) + "...", href: _W.etherscanHashUrl(hash), target: "_blank", rel: "noopener noreferrer" });
			return anchor[0].outerHTML;
		} else {
			return hash;
		}
	} else {
		return "?";
	}
}

function getAddressLink(token) {
	if (token.address == config.ETH.address) {
		return "ETH";
	} else {
		let anchor = $("<a />", { text: token.symbol, href: _W.etherscanAddressUrl(token.address), target: "_blank", rel: "noopener noreferrer" });
		return anchor[0].outerHTML;
	}
}

// show withdraw modal after clicking a withdraw button
function showWithdraw(tokenAddr) {
	//check if tokenAddr is still a valid address
	if (tokenAddr && _W.isAddress(tokenAddr)) {

		//update nonce, in case a tx has beent sent outside of this page, while it was open
		_W.updateNonce();

		// if we did not get a gas update or it has been longer than 3 minutes, update gas prices
		if (!config.lastGasPrices || (Date.now() - config.lastGasPrices.time >= 180000)) {
			loadGasPrices();
		}

		hide(".withdrawStep1", false);
		hide(".withdrawStep2", true);

		$("#withdrawConfirm").attr("disabled", true);
		$("#withdrawConfirm2").attr("disabled", true);
		$("#withdrawAmountInput").attr("disabled", false);


		hide(".withdrawError", true);


		let currentAccount = _W.currentAccount;
		let token = config.tokenMap[tokenAddr];
		currentWithdrawToken = token;

		let maxAmount = currentAccount.exchangeBalances[token.address];
		let ethbalance = currentAccount.walletBalances[config.ETH.address];

		//set form values
		$("#withdrawGasPrice").val(gasAvg);
		$("#withdrawGasLimit").val(0);
		$("#withdrawGasLimit").attr("disabled", true);
		$("#withdrawGasLimit").attr("min", String(config.gasLimits.minimum));
		$("#withdrawGasLimit").attr("max", String(config.gasLimits.maximum));


		hide("#gaslimitLoad", true);
		hide("#gaslimitCalc", false);

		// set all values
		$("#ethbalance").val(_W.weiToUnit(ethbalance));
		$("#withdrawAvailable").val(_W.weiToUnit(maxAmount, token));
		$("#withdrawAmountInput").val(0);


		$(".withdrawTokenName").each(function (index, value) {
			let symbol = token.symbol;
			//limit output length for tokens with very long names
			if (symbol) {
				symbol = symbol.slice(0, 10);
				if (symbol.length == 10) {
					symbol += "...";
				}
			}
			$(this).text(token.symbol);
		});

		validateWithdraw();

		$("#withdrawModal").modal("show");
	}
}

// confirm a withdraw, show a secondary modal for a final confirmation
function confirmWithdraw() {
	let obj = validateWithdraw();
	if (obj) {
		hide(".withdrawStep1", true);
		hide(".withdrawStep2", false);
		$("#withdrawConfirm2").attr("disabled", false);
		$("#withdrawAmountInput").attr("disabled", true);

		// hide tx sending warning for metamask users, as they will get another popup
		if (_W.currentAccount && _W.currentAccount.type === "metamask") {
			hide("#confirmWarning", true);
		}
	}
}

//hit back button on withdraw confirm popup
function revertWithdraw() {
	$("#withdrawConfirm2").attr("disabled", true);
	$("#withdrawAmountInput").attr("disabled", false);
	hide(".withdrawStep1", false);
	hide(".withdrawStep2", true);
}



// validate the values in the withdraw modal
function validateWithdraw() // TODO, check XSS
{
	hide("#withdrawGasError", true);

	let currentAccount = _W.currentAccount;
	let token = currentWithdrawToken;

	// these return corrected numbers
	let amount = validateWithdrawAmount($("#withdrawAmountInput").val(), token);
	let limit = validateGasLimit($("#withdrawGasLimit").val()); // can return -1 as exception
	let price = validateGasPrice($("#withdrawGasPrice").val());

	// set corrected values back in the modal
	$("#withdrawGasPrice").val(price);
	$("#withdrawAmountInput").val(_W.weiToUnit(amount, token));
	$("#withdrawGasLimit").val(limit);

	let walletETH = currentAccount.walletBalances[config.ETH.address];
	let gasCost = walletETH;
	if ((limit || limit === 0) && price) {
		let lim = Math.max(limit, 0);
		gasCost = _W.unitToWei(price, { decimals: 9 }).mul(lim);
		let displayGasCost = _W.weiToUnit(gasCost);
		$("#estimatecost").val(displayGasCost);
	}
	else {
		$("#estimatecost").val("");
	}

	const disabled = _W.isAccountReadOnly();

	// return the values to use them if its all ok
	if (!disabled && amount && amount.gt(0) && limit > 0 && price > 0 && gasCost.lt(walletETH)) {
		$("#withdrawConfirm").attr("disabled", false);
		// return gas in wei, not Gwei
		return { "token": token, "amount": amount, "gasPrice": _W.unitToWei(price, { decimals: 9 }), "gasLimit": limit };
	} else {
		if (gasCost.gte(walletETH)) {
			hide("#withdrawGasError", false);
		}

		$("#withdrawConfirm").attr("disabled", true);
		return undefined;
	}
}

// perform a withdraw transaction
function performWithdraw() {
	let obj = validateWithdraw();
	if (obj) {
		$("#withdrawModal").modal("hide");
		if (_W.currentAccount && _W.currentAccount.type === "metamask") {
			$("#confirmModal").modal("show");
		}

		// add the tx to the withdrawals table
		let txIndex = addWithdrawTransaction(_W.currentAccount.address, obj.token, obj.amount);

		//send the withdraw
		_W.sendWithdraw(obj.token, obj.amount, obj.gasPrice, obj.gasLimit).then(transaction => {

			if (_W.currentAccount && _W.currentAccount.type === "metamask") {
				$("#confirmModal").modal("hide"); //dismiss confirm modal
			}

			if (!transaction.hash || transaction.hash == "0x0000000000000000000000000000000000000000000000000000000000000000") {
				updateWithdrawTransaction(txIndex, obj.token, obj.amount, "Sending failed", "-");
			} else {
				pendingTx = true;
				//succeed, update tx hash in withdraws table
				updateWithdrawTransaction(txIndex, obj.token, obj.amount, "Pending", transaction.hash);

				if (transaction.wait) {
					try {
						//use the included promise that gets a receipt when the tx is mined
						transaction.wait().then(receipt => {
							if (receipt && receipt.transactionHash) {
								updateTxWithReceipt(receipt);
							}
						});
					} catch (e) { }
				}
			}

		}, err => {

			if (_W.currentAccount && _W.currentAccount.type === "metamask") {
				$("#confirmModal").modal("hide"); //dismiss confirm modal
			}

			//fail
			if (err && typeof err === "string") {
				updateWithdrawTransaction(txIndex, obj.token, obj.amount, err, "-");
			} else {
				updateWithdrawTransaction(txIndex, obj.token, obj.amount, "Sending Failed", "-");
			}
		});
	}
}

// gas price buttons
function setGasPrice(index) {
	if (index == 1) {
		$("#withdrawGasPrice").val(gasAvg);
	} else if (index == 2) {
		$("#withdrawGasPrice").val(gasFast);
	} else {
		$("#withdrawGasPrice").val(gasLow);
	}
	validateWithdraw();
}

//validate the token amount to withdraw
function validateWithdrawAmount(amount, token) {
	amount = String(amount).replace(/[^\d,.]/g, ""); // allow only number and decimal separator
	if (!amount) {
		amount = 0;
	}
	amount = _W.unitToWei(amount, token);
	let max = _W.currentAccount.exchangeBalances[token.address];
	if (amount.gt(max))
		amount = max;
	if (amount.lt(0))
		amount = _W.toBigNumber(0);

	return amount;
}

//validate the entered gas price
function validateGasPrice(price) {

	price = String(price).replace(/[^\d]/g, ""); // remove any non digits
	if (!price) {
		price = gasAVg;
	}
	price = Number(price);
	const max = 100;
	const min = 1;
	if (price > max)
		price = max;
	if (price < min)
		price = min;

	return Math.floor(Number(price));
}

function validateGasLimit(limit) {

	if (limit === "-1" || limit === "0") { // gas will run out, or gas limit has not been set yet
		return Number(limit);
	} else {
		limit = String(limit).replace(/[^\d]/g, ""); // remove any non digits
		if (!limit) {
			limit = config.gasLimits.default;
		}
		limit = Number(limit);
		if (limit < config.gasLimits.minimum)
			limit = config.gasLimits.minimum;
		if (limit > config.gasLimits.maximum)
			limit = config.gasLimits.maximum;

		return Math.floor(Number(limit));
	}
}

//set withdraw value to max
function setMaxBalance() {
	let max = $("#withdrawAvailable").val();
	$("#withdrawAmountInput").val(max);
	validateWithdraw();
}

// get the estimated gas limit for the current modal values
function estimateGasCurrentWithdraw() {
	hide("#gasLimitWarning", true);
	hide("#gasLimitError", true);
	$("#withdrawGasLimit").attr("disabled", true);

	let token = currentWithdrawToken;
	//take max, as the specific amount doesn"t matter for the estimate
	let amount = _W.currentAccount.exchangeBalances[token.address];;

	hide("#gaslimitLoad", false);
	hide("#gaslimitCalc", true);

	let id = modalId;
	_W.withdrawEstimate(token, amount).then(result => {
		if (id == modalId) { // only handle the result if the modal is still correct
			if (result.limit) {
				let limit = Math.round(result.limit + config.gasLimits.offset);
				$("#withdrawGasLimit").val(limit);
				$("#withdrawGasLimit").attr("disabled", false);
				$("#withdrawGasLimit").attr("min", String(limit));
			} else if (result.willFail) {
				hide("#gasLimitError", false);
				$("#withdrawGasLimit").attr("disabled", true);
				$("#withdrawGasLimit").val(-1); // will show warning after validateWithdraw()
			} else {
				$("#withdrawGasLimit").val(config.gasLimits.default);
				$("#withdrawGasLimit").attr("disabled", false);
				$("#withdrawGasLimit").attr("min", String(config.gasLimits.minimum));
				hide("#gasLimitWarning", false);
			}
			validateWithdraw();
			hide("#gaslimitLoad", true);
			hide("#gaslimitCalc", false);
		}
	}, e => {
		//unknown error
		if (id == modalId) {
			$("#withdrawGasLimit").val(config.gasLimits.default);
			$("#withdrawGasLimit").attr("disabled", false);
			validateWithdraw();
			hide("#gaslimitLoad", true);
			hide("#gaslimitCalc", false);
		}
	});

}

// add a sent transaction to the table
function addWithdrawTransaction(user, token, amount) {
	let tx = {
		"type": "Withdraw",
		"token": token,
		"amount": amount,
		"hash": "",
		"state": "Sending",
		"created": Date.now(),
		"from": user,
	};

	_W.withdrawTransactions.push(tx);


	let dt = $("#withdrawsTable").dataTable().api();
	dt.row.add([getTokenLink(token), _W.weiToUnit(tx.amount, token), getHashLink(tx.hash), tx.state, formatDate(tx.created)]);
	dt.draw();

	return _W.withdrawTransactions.length - 1;
}

//update the status of a transaction in the table
function updateWithdrawTransaction(txIndex, token, amount, state, hash) {
	if (txIndex < _W.withdrawTransactions.length) {
		let tx = _W.withdrawTransactions[txIndex];
		tx.token = token;
		tx.amount = amount;
		tx.state = state;
		tx.hash = hash;

		_W.withdrawTransactions[txIndex] = tx;

		if (_W.currentAccount && _W.currentAccount.address === tx.from) {
			drawWithdrawsTable();

			if (tx.state == "Pending") {
				hide("#withdrawRefreshButton", false);
				$("#withdrawRefreshButton").attr("disabled", false);
			}
		}
	}
}

// reload and check all (pending) transactions in the withdraw table
function reloadWithdrawsTable(forceRedraw = false) {

	let count = _W.withdrawTransactions.length;
	let loaded = 0;
	let pending = false;
	let newMined = false;

	if (count <= 0 && !forceRedraw) {
		//hide refresh button and return
		$("#withdrawRefreshButton").attr("disabled", true);
		$("#withdrawRefreshIcon").removeClass("fa-spin");
		hide("#withdrawRefreshButton", true);
		return;
	} else {
		hide("#withdrawRefreshButton", false);
		$("#withdrawRefreshButton").attr("disabled", true);
		$("#withdrawRefreshIcon").addClass("fa-spin");
	}

	_W.withdrawTransactions.forEach(tx => {
		if (tx.hash && tx.hash !== "?" && tx.state === "Pending") {

			_W.getTransactionReceipt(tx.hash).then(result => {
				loaded++;
				if (result.status == 1 || (result.logs && _W.getWithdrawFromLogs(result.logs))) {
					tx.state = "Success";
				} else {
					tx.state = "Failed";
				}
				newMined = true;
				handleTx();
			}, e => {
				// tx not found
				loaded++;
				pending = true;
				handleTx();
			});

		} else {
			// a finished or rejected tx doesn"t need updating
			loaded++;
		}
	});
	handleTx();

	function handleTx() {
		if (loaded >= count) {
			pendingTx = pending;

			//redraw the table, even if there were no changes (visual feedback to refresh)
			drawWithdrawsTable();
			if (newMined) {
				_W.updateAccountBalanceETH(); // tx cost some gas, so update ETH
			}

			$("#withdrawRefreshButton").attr("disabled", !pendingTx);
			$("#withdrawRefreshIcon").removeClass("fa-spin");
			hide("#withdrawRefreshButton", !pendingTx);
		}
	}
}

function drawWithdrawsTable() {
	if (!setupDatatables) {
		console.log('withdrawals table not initialized');
		return;
	}

	let dt = $("#withdrawsTable").dataTable().api();
	dt.clear();

	if (_W.currentAccount) {
		let user = _W.currentAccount.address;
		_W.withdrawTransactions.forEach(tx => {
			if (user === tx.from) {
				dt.row.add([getTokenLink(tx.token), _W.weiToUnit(tx.amount, tx.token), getHashLink(tx.hash), tx.state, formatDate(tx.created)]);
			}
		});
	}
	dt.draw();
}

//retrieve a receipt from a completed tx, match it with our list of sent transactions
function updateTxWithReceipt(receipt) {
	if (receipt && receipt.transactionHash) {

		_W.updateAccountBalanceETH(); // tx cost some gas, so update ETH

		for (let i = 0; i < _W.withdrawTransactions.length; i++) {
			let tx = _W.withdrawTransactions[i];
			if (tx.hash && tx.hash.toLowerCase() == receipt.transactionHash.toLowerCase()) {

				let event = undefined;
				if (receipt.logs) {
					try {
						event = _W.getWithdrawFromLogs(receipt.logs);
					} catch (e) { }
				}

				if (receipt.status == 1 || event) {
					tx.state = "Success";
				} else {
					tx.state = "Failed";
				}

				// update exchange balance with amount reported by the Withdraw event
				if (event && _W.currentAccount && _W.currentAccount.address === event.user) {
					_W.currentAccount.exchangeBalances[event.token.address] = event.exchangeBalance;
					drawBalancesTable();
				}

				_W.withdrawTransactions[i] = tx;

				// use the regular update to correct all states/settings
				reloadWithdrawsTable(true);
				return;
			}
		}
	}
}



function showTokenModal() {
	currentAdditionToken = undefined;
	$("#tokenAddressInput").attr("disabled", false);
	$("#tokenAddressInput").val("");
	$("#symbolInput").val("");
	$("#decimalInput").val("");

	validateTokenAddress();
	$("#addTokenModal").modal("show");
}


//validate the token contract in the addToken Modal
function validateTokenAddress(isOnInput = false) {

	let address = $("#tokenAddressInput").val();
	//remove non alphanumeric characters
	let cleanedString = JSON.stringify(address).replace(/[^0-9a-z]/gi, "");
	if (cleanedString !== address) {
		$("#tokenAddressInput").val(cleanedString);
	}
	address = cleanedString;

	//triggered on a paste instead of a loss of focus, do a quick check and stop if not valid
	if (isOnInput && !(address.length == 42 && _W.isAddress(address))) {
		return false;
	}
	// correct input onchange, onInput would have already gotten it, block this one
	else if (!isOnInput && (address.length == 42 && _W.isAddress(address))) {
		return false;
	}

	currentAdditionToken = undefined;
	hide(".tokenDetails", true);
	hide(".tokenError", true);

	$("#symbolInput").attr("disabled", true);
	$("#decimalInput").attr("disabled", true);
	$("#tokenConfirm").attr("disabled", true);

	if (!address) {
		hide(".tokenDetails", true);

	} else if (_W.isAddress(address)) {
		if (config.tokenMap[address.toLowerCase()]) {
			hide("#tokenDuplicateError", false);
		} else {
			hide(".tokenDetails", false);
			hide(".tokenDetailLoad", false);

			_W.getTokenDetails(address).then(token => {
				hide(".tokenDetailLoad", true);
				$("#decimalInput").val(token.decimals);
				$("#symbolInput").val(token.symbol);
				$("#tokenAddressInput").attr("disabled", true);
				$("#tokenConfirm").attr("disabled", false);
				currentAdditionToken = token;

			}, err => {
				hide(".tokenDetailLoad", true);
				hide("#tokenLoadError", false);
			});
		}
	}
	else {
		$("#tokenAddressError").text("Not a valid Ethereum address");
		hide("#tokenAddressError", false);
	}
}

//add a user specified token to the list of known tokens
function addModalToken() {
	if (currentAdditionToken && currentAdditionToken.address) {
		const addr = currentAdditionToken.address;
		if (!config.tokenMap[addr]) {
			config.tokenMap[addr] = currentAdditionToken;
			config.tokens.push(currentAdditionToken);
			// TODO add to browser cache?
		}
	}
	$("#addTokenModal").modal("hide");
}

// handle change events emitted by metamask
function handleMetamaskEvents() {
	//current mmetamask network change event
	window.ethereum.on("networkChanged", function (netId) {
		if (selectedIndex > -1) { //avoid triggering on page load in firefox
			document.location.reload();
		}
	})
	//future metamask network change event
	window.ethereum.on("chainChanged", (hexId) => {
		if (selectedIndex > -1) { //avoid triggering on page load in firefox
			document.location.reload();
		}
	});

	//metamask account changes (account change:  [..],  login: [..], page load: [empty], logout: [empty])
	window.ethereum.on("accountsChanged", function (accounts) {
		//triggers with empty accounts array on page load
		if (accounts && accounts.length > 0) {
			// unlocked on this account and it changes
			if (unlocked && _W.currentAccount.type == "metamask") {
				resetWallet();
			}
			// detect change when on metamask select screen
			if (selectedIndex == 1 && !_W.ethereumEnablePending) {
				loadMetamask();
			}
		} else if (unlocked && _W.currentAccount.type == "metamask") {
			//application is on balances screen and metamask logout
			resetWallet();
			if (selectedIndex == 1) { //update account selection screen
				loadMetamask(true);
			}
		} else {
			//metamask logout while on metamask select screen
			if (selectedIndex == 1 && !_W.ethereumEnablePending) {
				loadMetamask(true);
			}
		}
	})
}

//return date formatted like 2020-12-01 13:00:02
function formatDate(d) {
	let date = d;
	if (typeof date == "string" || typeof date == "number") {
		date = new Date(d)
	}
	if (date) {
		return date.getFullYear() + "-"
			+ pad(date.getMonth() + 1) + "-"
			+ pad(date.getDate()) + " "
			+ pad(date.getHours()) + ":"
			+ pad(date.getMinutes()) + ":"
			+ pad(date.getSeconds());

		function pad(n) { return n < 10 ? "0" + n : n }
	} else {
		return undefined;
	}
}

