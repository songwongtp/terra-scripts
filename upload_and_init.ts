import "dotenv/config";
import {
  LCDClient,
  LocalTerra,
  Wallet,
  MnemonicKey,
  MsgStoreCode,
  Msg,
  isTxError,
  MsgInstantiateContract,
  getCodeId,
  getContractAddress,
} from "@terra-money/terra.js";
import * as child_process from "child_process";
import * as os from "os";
import { readFileSync } from "fs";

export async function sleep(timeout: number) {
  await new Promise((resolve) => setTimeout(resolve, timeout));
}

//////////////////////////////////////////////////////////////////////////
///                           LCD CLIENT
//////////////////////////////////////////////////////////////////////////

export function recover(terra: LCDClient, mnemonic: string) {
  const mk = new MnemonicKey({ mnemonic: mnemonic });
  return terra.wallet(mk);
}

export interface Client {
  wallet: Wallet;
  terra: LCDClient | LocalTerra;
}

export function newClient(): Client {
  const client = <Client>{};
  if (process.env.WALLET) {
    client.terra = new LCDClient({
      URL: String(process.env.LCD_CLIENT_URL),
      chainID: String(process.env.CHAIN_ID),
      gasPrices: { uusd: 0.15 },
    });
    client.wallet = recover(client.terra, process.env.WALLET);
  } else {
    client.terra = new LocalTerra();
    client.wallet = (client.terra as LocalTerra).wallets.test1;
  }
  return client;
}

//////////////////////////////////////////////////////////////////////////
///                                 TX
//////////////////////////////////////////////////////////////////////////

export async function performTransaction(
  terra: LCDClient,
  wallet: Wallet,
  msg: Msg
) {
  const signedTx = await wallet.createAndSignTx({ msgs: [msg] });
  const result = await terra.tx.broadcast(signedTx);

  if (isTxError(result)) {
    throw new Error(
      `Transaction fails: code - ${result.code}, ${result.codespace}\n${result.raw_log}`
    );
  }

  return result;
}

export async function uploadContract(
  terra: LCDClient,
  wallet: Wallet,
  filepath: string
) {
  const contract = readFileSync(filepath, "base64");
  const uploadMsg = new MsgStoreCode(wallet.key.accAddress, contract);
  let result = await performTransaction(terra, wallet, uploadMsg);

  return Number(getCodeId(result));
}

export async function instantiateContract(
  terra: LCDClient,
  wallet: Wallet,
  adminAddress: string,
  codeId: number,
  initMsg: object
) {
  const instantiateMsg = new MsgInstantiateContract(
    wallet.key.accAddress,
    adminAddress,
    codeId,
    initMsg,
    undefined
  );
  let result = await performTransaction(terra, wallet, instantiateMsg);

  return getContractAddress(result);
}

//////////////////////////////////////////////////////////////////////////
///                               MAIN
//////////////////////////////////////////////////////////////////////////

const PROJECT = "bbv";
const initMsg = {
  vault_address: "terra1zljypewdglfl5f6ntfl2r3epgxjmzh05qnjknv",
  incentive_address: "terra1x7ug3ehdtdz5w2q37l2l9rd0u5ekv2gvzfq0y6",
  astroport_factory_address: "terra15jsahkaf9p0qu8ye873p0u5z6g07wdad0tdq43",
  aust_token_address: "terra1ajt556dpzvjwl0kl5tzku3fc3p3knkg9mkv8jl",
  anchor_market_contract: "terra15dwd5mj8v59wpj0wvt233mf5efdff808c5tkal",
  profit_threshold: "3000000", // 3 UST
};

async function main() {
  child_process.execSync(
    "RUSTFLAGS='-C link-arg=-s' cargo build --release --target wasm32-unknown-unknown",
    { cwd: `${os.homedir()}/${PROJECT}` }
  );

  const { terra, wallet } = newClient();
  const adminAddress = process.env.ADMIN
    ? process.env.ADMIN
    : wallet.key.accAddress;

  const codeId = await uploadContract(
    terra,
    wallet,
    `${os.homedir()}/${PROJECT}/target/wasm32-unknown-unknown/release/${PROJECT}.wasm`
  );
  console.log(`Code ID: ${codeId}`);

  await sleep(5000);

  const contractAddress = await instantiateContract(
    terra,
    wallet,
    adminAddress,
    codeId,
    initMsg
  );
  console.log(`Contract Address: ${contractAddress}`);

  if (process.env.CHAIN_ID) {
    console.log();
    console.log(
      `https://station.terra.money/contract/execute/${contractAddress}`
    );
    let network = process.env.CHAIN_ID.includes("columbus")
      ? "mainnet"
      : "testnet";
    console.log(`https://terrasco.pe/${network}/contract/${contractAddress}`);
  }
}

main().catch(console.log);

/*
{
"flash_loan": {
"cluster_address": "terra1f08qvrr4gpwdxqlxpgg559kdc5wl2gzgh3c00a"
}
}
*/
