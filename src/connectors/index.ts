import { Web3Provider } from '@ethersproject/providers'
import { InjectedConnector } from '@web3-react/injected-connector'
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'
import { WalletLinkConnector } from '@web3-react/walletlink-connector'
import { PortisConnector } from '@web3-react/portis-connector'
import { JsonRpcSigner } from "@ethersproject/providers";
import { resolveProperties, shallowCopy } from "@ethersproject/properties";
import { Logger } from "@ethersproject/logger";
import { version } from "@ethersproject/providers/lib/_version";
import { FortmaticConnector } from './Fortmatic'
import { NetworkConnector } from './NetworkConnector'
import { Formatter } from "@ethersproject/providers";

const tp: any = require("tp-js-sdk");
const logger = new Logger(version);



Formatter.prototype.getDefaultFormats = function () {
  const formats:any = ({});
  const address = this.address.bind(this);
  const bigNumber = this.bigNumber.bind(this);
  const blockTag = this.blockTag.bind(this);
  const data = this.data.bind(this);
  const hash = this.hash.bind(this);
  const hex = this.hex.bind(this);
  const number = this.number.bind(this);
  const strictData = (v: any) => { return this.data(v, true); };
  formats.transaction = {
    hash: hash,
    blockHash: Formatter.allowNull(hash, null),
    blockNumber: Formatter.allowNull(number, null),
    transactionIndex: Formatter.allowNull(number, null),
    confirmations: Formatter.allowNull(number, null),
    from: address,
    gasPrice: bigNumber,
    gasLimit: bigNumber,
    to: Formatter.allowNull(address, null),
    value: bigNumber,
    nonce: number,
    data: data,
    r: Formatter.allowNull(this.uint256),
    s: Formatter.allowNull(this.uint256),
    v: Formatter.allowNull(number),
    creates: Formatter.allowNull(address, null),
    raw: Formatter.allowNull(data),
  };
  formats.transactionRequest = {
    from: Formatter.allowNull(address),
    nonce: Formatter.allowNull(number),
    gasLimit: Formatter.allowNull(bigNumber),
    gasPrice: Formatter.allowNull(bigNumber),
    to: Formatter.allowNull(address),
    value: Formatter.allowNull(bigNumber),
    data: Formatter.allowNull(strictData),
  };
  formats.receiptLog = {
    transactionIndex: number,
    blockNumber: number,
    transactionHash: hash,
    address: address,
    topics: Formatter.arrayOf(hash),
    TxData: data,
    logIndex: number,
    blockHash: hash,
  };
  formats.receipt = {
    to: Formatter.allowNull(this.address, null),
    from: Formatter.allowNull(this.address, null),
    contractAddress: Formatter.allowNull(address, null),
    transactionIndex: number,
    root: Formatter.allowNull(hash),
    gasUsed: bigNumber,
    logsBloom: Formatter.allowNull(data),
    blockHash: hash,
    transactionHash: hash,
    logs: Formatter.arrayOf(this.receiptLog.bind(this)),
    blockNumber: number,
    confirmations: Formatter.allowNull(number, null),
    cumulativeGasUsed: bigNumber,
    status: Formatter.allowNull(number)
  };
  formats.block = {
    hash: hash,
    parentHash: hash,
    number: number,
    timestamp: number,
    nonce: Formatter.allowNull(hex),
    difficulty: this.difficulty.bind(this),
    gasLimit: bigNumber,
    gasUsed: bigNumber,
    miner: address,
    extraData: data,
    transactions: Formatter.allowNull(Formatter.arrayOf(hash)),
  };
  formats.blockWithTransactions = shallowCopy(formats.block);
  formats.blockWithTransactions.transactions = Formatter.allowNull(Formatter.arrayOf(this.transactionResponse.bind(this)));
  formats.filter = {
    fromBlock: Formatter.allowNull(blockTag, undefined),
    toBlock: Formatter.allowNull(blockTag, undefined),
    blockHash: Formatter.allowNull(hash, undefined),
    address: Formatter.allowNull(address, undefined),
    topics: Formatter.allowNull(this.topics.bind(this), undefined),
  };
  formats.filterLog = {
    blockNumber: Formatter.allowNull(number),
    blockHash: Formatter.allowNull(hash),
    transactionIndex: number,
    removed: Formatter.allowNull(this.boolean.bind(this)),
    address: address,
    data: Formatter.allowFalsish(data, "0x"),
    topics: Formatter.arrayOf(hash),
    transactionHash: hash,
    logIndex: number,
  };
  return formats;
}


JsonRpcSigner.prototype.sendUncheckedTransaction = function (transaction) {
  console.log("over write send unchecked transaction: ", transaction);
  transaction = shallowCopy(transaction);
  const fromAddress = this.getAddress().then((address) => {
    if (address) {
      address = address.toLowerCase();
    }
    return address;
  });
  // The JSON-RPC for eth_sendTransaction uses 90000 gas; if the user
  // wishes to use this, it is easy to specify explicitly, otherwise
  // we look it up for them.
  const value = transaction.value ? transaction.value.toString() : "0";
  const gasLimit = transaction.gasLimit ? transaction.gasLimit.toString() : 5000000
  return resolveProperties({
    tx: resolveProperties(transaction),
    sender: fromAddress
  }).then(async ({ tx, sender }) => {
    if (tx.from != null) {
      if (tx.from.toLowerCase() !== sender) {
        logger.throwArgumentError("from address mismatch", "transaction", transaction);
      }
    }
    else {
      tx.from = sender;
    }
    // @ts-ignore
    const hexTx = this.provider.constructor["hexlifyTransaction"](tx, { from: true });

    delete hexTx.gas;
    var Chain3 = require('chain3');

    const res = await tp.getAppInfo();
    const system = res?.data?.system;
    

    const nodeUrl = await tp.getNodeUrl({blockchain: 'moac'});
    const chain3 = new Chain3(new Chain3.providers.HttpProvider(nodeUrl?.data?.nodeUrl));
    const gasPrice = chain3.toSha(100, "gsha");

    hexTx.chainId = Number(chain3.version.network);
   
    if (system === "ios") {
      hexTx.gasLimit = gasLimit;
      hexTx.gasPrice = gasPrice;
      hexTx.value = value;
    } else {
      hexTx.gasLimit = chain3.intToHex(gasLimit);
      hexTx.gasPrice = chain3.intToHex(gasPrice);
      hexTx.value = chain3.intToHex(value);
    }

    return new Promise((resolve, reject) => {
      tp.sendMoacTransaction(hexTx).then((res :any) => {
        if (res.result) {
          return resolve(res.data);
        } else {
          return reject(new Error(JSON.stringify(res)));
        }
       }).catch((error: Error) => {
        return reject(error);
       })
      
    })
  });
}

InjectedConnector.prototype.getAccount = async (): Promise<null | string> => {
  try {
    const wallet = await tp.getCurrentWallet();
    return wallet.data.address
  } catch (error) {
    return null;
  }
}

const NETWORK_URL = process.env.REACT_APP_NETWORK_URL
const FORMATIC_KEY = process.env.REACT_APP_FORTMATIC_KEY
const PORTIS_ID = process.env.REACT_APP_PORTIS_ID

export const NETWORK_CHAIN_ID: number = parseInt(process.env.REACT_APP_CHAIN_ID ?? '1')

if (typeof NETWORK_URL === 'undefined') {
  throw new Error(`REACT_APP_NETWORK_URL must be a defined environment variable`)
}

export const network = new NetworkConnector({
  urls: { [NETWORK_CHAIN_ID]: NETWORK_URL }
})

let networkLibrary: Web3Provider | undefined
export function getNetworkLibrary(): Web3Provider {
  return (networkLibrary = networkLibrary ?? new Web3Provider(network.provider as any))
}

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42]
})

// mainnet only
export const walletconnect = new WalletConnectConnector({
  rpc: { 1: NETWORK_URL },
  bridge: 'https://bridge.walletconnect.org',
  qrcode: true,
  pollingInterval: 15000
})

// mainnet only
export const fortmatic = new FortmaticConnector({
  apiKey: FORMATIC_KEY ?? '',
  chainId: 1
})

// mainnet only
export const portis = new PortisConnector({
  dAppId: PORTIS_ID ?? '',
  networks: [1]
})

// mainnet only
export const walletlink = new WalletLinkConnector({
  url: NETWORK_URL,
  appName: 'Uniswap',
  appLogoUrl:
    'https://mpng.pngfly.com/20181202/bex/kisspng-emoji-domain-unicorn-pin-badges-sticker-unicorn-tumblr-emoji-unicorn-iphoneemoji-5c046729264a77.5671679315437924251569.jpg'
})
