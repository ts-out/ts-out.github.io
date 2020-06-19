# Ts-out [Beta]
----------
###### This project is in beta, use at your own risk.  

## About
----------
This is a tool to extract funds from the [token.store (ETH)](https://token.store) decentralized exchange.  
It was made in collaboration with the token.store team.

Even if the website of a DEX dissapears, the funds deposited in the smart contract are still yours.  
You just need a different way to interact with the [token.store smart contract](https://etherscan.io/address/0x1ce7ae555139c5ef5a57cc8d814a867ee6ee33d8)  

[ts-out](https://ts-out.github.io) is one way to interact with the contract and withdraw your tokens.  


## Token.store
----------
The token.store ETH decentralized exchange is shutting down on June 22 2020.  
Check the token.store media for info:  
- Exchange [website](https://token.store)
- [Twitter](https://twitter.com/TokenDotStore) 
- Support on [Telegram](https://t.me/thetokenstore)



## FAQ
----------
##### Why should I trust you?
* All code is public on github, anyone can check that it isn't doing anything malicious.
* This tool is linked on the token.store twitter and website.

Please use MetaMask or a similar Web3 wallet, using private keys on a website is a bad idea.  

If you don't trust this tool, you can always use the READ-ONLY mode to check your token balances, and withdraw them using an alternative method.

##### My token Withdrawal always fails
ERC20 tokens can have their settings changed by their creators. Some tokens get Paused, Locked or Disabled.  
For example for a swap to a new smart contract or a different mainnet.

Contact the token creator with your issue, nobody else can move those tokens for you.

For an example of what a locked token looks like, see [this token](https://etherscan.io/address/0xe94327d07fc17907b4db788e5adf2ed424addff6). 
- The majority of the transactions to this token fail
- The last token transfer was in july 2018
- Etherscan even has an announcement banner.

##### Why don't you support (Ledger, Trezor, ....)?
The token.store website only offered 2 ways to connect to the account: Private Key and Metamask.
For simplicity this tool supports the same wallets as the exchange.

##### Can I run this tool (locally/ offline)?
You can download and run this tool local on your own computer. 
- Just download the files in this github repo
  - For private key wallets, you can open index.html in your browser
  - For MetaMask, you need to host index.html on a localhost server.
- If run this code on a different domain, you might need to replace the API keys for Etherscan and Infura in `config.js`, as those are limited to certain domains.

It won't work fully offline because it requires internet to check balances and send transactions.


## Alternatives
----------
##### Etherscan
(Requires MetaMask or another Web 3 wallet)  
 View the smart contract [on etherscan](https://etherscan.io/address/0x1ce7ae555139c5ef5a57cc8d814a867ee6ee33d8) and go to the contract tab.
 
 ![read contract](https://github.com/ts-out/ts-out.github.io/raw/master/img/readme/readContract.png)
- On Read Contract, check your balance using `balanceOf`  
  - Enter the contract address of the ERC20 token and your wallet address.
  (for ETH use `0x000000000000000000000000000000000000000`)  
  - Hit query, and copy the resulting number. (this number will often be 10-18x higher than you might think)  
 ![balanceOf example](https://github.com/ts-out/ts-out.github.io/raw/master/img/readme/balanceOf.png)
 
 ![wrtie contract](https://github.com/ts-out/ts-out.github.io/raw/master/img/readme/writeContract.png)
- On the Write contract tab
  - Click Connect to Web3 to enable your wallet
  - use `withdrawToken` to withdraw ERC20 tokens or `withdraw` to withdraw ETH (`0x000000000000000000000000000000000000000`)
  - Paste the exact amount copied from balanceOf 

![withdrawToken](https://github.com/ts-out/ts-out.github.io/raw/master/img/readme/withdrawToken.png)


##### MyEtherWallet
(works with nearly any type of wallet)
- Unlock your wallet
- Head to the Contract tab
- Enter contract address `0x1cE7AE555139c5EF5A57CC8d814a867ee6Ee33D8`
- Copy the ABI from below from and paste it in ABI
  - Now use `balanceOf`, `withdrawToken` and `withdraw` just like insturcted for Etherscan above.
  - Get your exact balance with `balanceOf`, and withdraw token withs `withdrawToken` and ETH with `withdraw`.
  - Use a higher gas limit, a withdraw might take from 50000 to 250000 gas depending on the token, some even higher.
  (use the ts-out site in READ-ONLY mode to calculate this gas)

`Tokenstore Withdraw ABI`
 ```
 [{"constant":false,"inputs":[{"name":"_amount","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"},{"name":"_amount","type":"uint256"}],"name":"withdrawToken","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_token","type":"address"},{"name":"_user","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"}]
 ```
  
##### Fork a similar exchange
Exchanges like EtherDelta, ForkDelta and Bitcratic use a very similar smart contract.
You can download their website to run it locally, and change the smart contract address in the config.
Orderbooks and history shouldn't work, but withdrawing tokens is likely to work.




  
