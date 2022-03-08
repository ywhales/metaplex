import {
  createAssociatedTokenAccountInstruction,
  createMint,
  createMetadata,
  programIds,
  notify,
  ENDPOINT_NAME,
  updateMetadata,
  createMasterEdition,
  sendTransactionWithRetry,
  Data,
  Creator,
  findProgramAddress,
  StringPublicKey,
  toPublicKey,
  WalletSigner,
  Attribute,
  getAssetCostToStore,
  FileOrString,
  MetadataFile
} from '@oyster/common';
import React, { Dispatch, SetStateAction } from 'react';
import { MintLayout, Token } from '@solana/spl-token';
import {
  Keypair,
  Connection,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import crypto from 'crypto';

import { AR_SOL_HOLDER_ID } from '../utils/ids';
import BN from 'bn.js';
import { UploadResponse } from 'react-aws-s3-typescript/dist/types';
import Policy from "react-aws-s3-typescript/dist/Policy";
import GetUrl from "react-aws-s3-typescript/dist/Url";
import {dateYMD, xAmzDate} from 'react-aws-s3-typescript/dist/Date';
import Signature from 'react-aws-s3-typescript/dist/Signature';

const RESERVED_TXN_MANIFEST = 'manifest.json';
const RESERVED_METADATA = 'metadata.json';
const randFilename = getRandomString(20);
const s3BucketUrlEnv = String(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL);
const bucketNameEnv = String(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME) ;
const regionEnv = String(process.env.NEXT_PUBLIC_AWS_REGION) ;
const accessKeyEnv = String(process.env.NEXT_PUBLIC_AWS_ACCESSKEY_ID) ;
const secretKeyEnv = String(process.env.NEXT_PUBLIC_AWS_SECRETACCESSKEY );

interface IConfig {
  bucketName: string;
  dirName?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  s3Url?: string;
}

export async function uploadFile(file: File, config: IConfig): Promise<UploadResponse> {

  const fd = new FormData();

  const fileName = `${file.name}`;
  const key = `${config.dirName ? config.dirName + '/' : ''}${fileName}`;
  const url: string = GetUrl(config);
  fd.append('key', key);
  fd.append('acl', 'public-read');
  fd.append('Content-Type', file.type);
  fd.append('x-amz-meta-uuid', '14365123651274');
  fd.append('x-amz-server-side-encryption', 'AES256');
  fd.append('X-Amz-Credential', `${config.accessKeyId}/${dateYMD}/${config.region}/s3/aws4_request`);
  fd.append('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  fd.append('X-Amz-Date', xAmzDate);
  fd.append('x-amz-meta-tag', '');
  fd.append('Policy', Policy.getPolicy(config));
  fd.append('X-Amz-Signature', Signature.getSignature(config, dateYMD, Policy.getPolicy(config)));
  fd.append('file', file);

  const data = await fetch(url, { method: 'post', body: fd });
  if (!data.ok) return Promise.reject(data);
  return Promise.resolve({
    bucket: config.bucketName,
    key: `${config.dirName ? config.dirName + '/' : ''}${fileName}`,
    location: `${url}/${config.dirName ? config.dirName + '/' : ''}${fileName}`,
    status: data.status,
  });
}

export async function awsUpload(
  files: File[],
) {

  const config = {
    bucketName: bucketNameEnv,
    dirName: randFilename,
    region: regionEnv,
    accessKeyId: accessKeyEnv,
    secretAccessKey: secretKeyEnv,
    s3Url: s3BucketUrlEnv,
  }

  const urlFiles: UploadResponse[] = [];

  for (const file of files)
  {
    try {
      const res = await uploadFile(file, config);
      urlFiles.push(res)
      console.log(res);
    } catch (exception) {
      console.log(exception);
    }
  }
  return urlFiles;
}

function getRandomString(length) {
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for ( let i = 0; i < length; i++ ) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
  }
  return result;
}


export const mintNFT = async (
  connection: Connection,
  wallet: WalletSigner | undefined,
  endpoint: ENDPOINT_NAME,
  files: File[],
  metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string | undefined;
    animation_url: string | undefined;
    attributes: Attribute[] | undefined;
    external_url: string;
    properties: any;
    creators: Creator[] | null;
    sellerFeeBasisPoints: number;
  },
  progressCallback: Dispatch<SetStateAction<number>>,
  maxSupply?: number,
): Promise<{
  metadataAccount: StringPublicKey;
} | void> => {
  if (!wallet?.publicKey) return;

  const metadataContent = {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    seller_fee_basis_points: metadata.sellerFeeBasisPoints,
    image: s3BucketUrlEnv+'/'+randFilename+'/'+metadata.image,
    animation_url: s3BucketUrlEnv+'/'+randFilename+'/'+metadata.animation_url,
    attributes: metadata.attributes,
    external_url: metadata.external_url,
    properties: {
      ...metadata.properties,
      creators: metadata.creators?.map(creator => {
        return {
          address: creator.address,
          share: creator.share,
        };
      }),
    },
  };

  metadataContent.properties.files.forEach((value: FileOrString) => {
    const valueFile = value as MetadataFile;
    valueFile.uri = s3BucketUrlEnv+'/'+randFilename+'/'+valueFile.uri;
  });

  const realFiles: File[] = [
    ...files,
    new File([JSON.stringify(metadataContent)], RESERVED_METADATA),
  ];

  const { instructions: pushInstructions, signers: pushSigners } =
    await prepPayForFilesTxn(wallet, realFiles, metadata);

  progressCallback(1);

  const TOKEN_PROGRAM_ID = programIds().token;

  // Allocate memory for the account
  const mintRent = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span,
  );
  // const accountRent = await connection.getMinimumBalanceForRentExemption(
  //   AccountLayout.span,
  // );

  // This owner is a temporary signer and owner of metadata we use to circumvent requesting signing
  // twice post Arweave. We store in an account (payer) and use it post-Arweave to update MD with new link
  // then give control back to the user.
  // const payer = new Account();
  const payerPublicKey = wallet.publicKey.toBase58();
  const instructions: TransactionInstruction[] = [...pushInstructions];
  const signers: Keypair[] = [...pushSigners];

  // This is only temporarily owned by wallet...transferred to program by createMasterEdition below
  const mintKey = createMint(
    instructions,
    wallet.publicKey,
    mintRent,
    0,
    // Some weird bug with phantom where it's public key doesnt mesh with data encode wellff
    toPublicKey(payerPublicKey),
    toPublicKey(payerPublicKey),
    signers,
  ).toBase58();

  const recipientKey = (
    await findProgramAddress(
      [
        wallet.publicKey.toBuffer(),
        programIds().token.toBuffer(),
        toPublicKey(mintKey).toBuffer(),
      ],
      programIds().associatedToken,
    )
  )[0];

  createAssociatedTokenAccountInstruction(
    instructions,
    toPublicKey(recipientKey),
    wallet.publicKey,
    wallet.publicKey,
    toPublicKey(mintKey),
  );

  const metadataAccount = await createMetadata(
    new Data({
      symbol: metadata.symbol,
      name: metadata.name,
      uri: ' ',
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      creators: metadata.creators,
    }),
    payerPublicKey,
    mintKey,
    payerPublicKey,
    instructions,
    wallet.publicKey.toBase58(),
  );
  progressCallback(2);

  // TODO: enable when using payer account to avoid 2nd popup
  // const block = await connection.getRecentBlockhash('singleGossip');
  // instructions.push(
  //   SystemProgram.transfer({
  //     fromPubkey: wallet.publicKey,
  //     toPubkey: payerPublicKey,
  //     lamports: 0.5 * LAMPORTS_PER_SOL // block.feeCalculator.lamportsPerSignature * 3 + mintRent, // TODO
  //   }),
  // );

  const { txid } = await sendTransactionWithRetry(
    connection,
    wallet,
    instructions,
    signers,
    'single',
  );

  progressCallback(3);

  try {
    await connection.confirmTransaction(txid, 'max');
    progressCallback(4);
  } catch (exception) {
    notify({
      message: 'Error:',
      description: (
        <a>
          ${exception}
        </a>
      ),
      type: 'error',
    });
  }

  // Force wait for max confirmations
  // await connection.confirmTransaction(txid, 'max');
  await connection.getParsedConfirmedTransaction(txid, 'confirmed');

  progressCallback(5);

  // this means we're done getting AR txn setup. Ship it off to ARWeave!
  const data = new FormData();

  const tags = realFiles.reduce(
    (acc: Record<string, Array<{ name: string; value: string }>>, f) => {
      acc[f.name] = [{ name: 'mint', value: mintKey }];
      return acc;
    },
    {},
  );
  data.append('tags', JSON.stringify(tags));
  realFiles.map(f => data.append('file[]', f));

  // TODO: convert to absolute file name for image

  const result: UploadResponse[] = await awsUpload(realFiles);

  progressCallback(6);
  const metadataFile = result.find(
    m => m.key.includes(RESERVED_METADATA)
  );

  if (metadataFile?.status == 204) {
    const updateInstructions: TransactionInstruction[] = [];
    const updateSigners: Keypair[] = [];

    // TODO: connect to testnet arweave
    const arweaveLink = metadataFile.location;
    await updateMetadata(
      new Data({
        name: metadata.name,
        symbol: metadata.symbol,
        uri: arweaveLink,
        creators: metadata.creators,
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      }),
      undefined,
      undefined,
      mintKey,
      payerPublicKey,
      updateInstructions,
      metadataAccount,
    );

    updateInstructions.push(
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        toPublicKey(mintKey),
        toPublicKey(recipientKey),
        toPublicKey(payerPublicKey),
        [],
        1,
      ),
    );

    progressCallback(7);
    // // In this instruction, mint authority will be removed from the main mint, while
    // // minting authority will be maintained for the Printing mint (which we want.)
    await createMasterEdition(
      maxSupply !== undefined ? new BN(maxSupply) : undefined,
      mintKey,
      payerPublicKey,
      payerPublicKey,
      payerPublicKey,
      updateInstructions,
    );

    // TODO: enable when using payer account to avoid 2nd popup
    /*  if (maxSupply !== undefined)
      updateInstructions.push(
        setAuthority({
          target: authTokenAccount,
          currentAuthority: payerPublicKey,
          newAuthority: wallet.publicKey,
          authorityType: 'AccountOwner',
        }),
      );
*/
    // TODO: enable when using payer account to avoid 2nd popup
    // Note with refactoring this needs to switch to the updateMetadataAccount command
    // await transferUpdateAuthority(
    //   metadataAccount,
    //   payerPublicKey,
    //   wallet.publicKey,
    //   updateInstructions,
    // );

    progressCallback(8);

    const txid = await sendTransactionWithRetry(
      connection,
      wallet,
      updateInstructions,
      updateSigners,
    );

    notify({
      message: 'Art created on Solana',
      description: (
        <a href={arweaveLink} target="_blank" rel="noopener noreferrer">
          Arweave Link
        </a>
      ),
      type: 'success',
    });

    // TODO: refund funds

    // send transfer back to user
  }
  // TODO:
  // 1. Jordan: --- upload file and metadata to storage API
  // 2. pay for storage by hashing files and attaching memo for each file
  return { metadataAccount };
};

export const prepPayForFilesTxn = async (
  wallet: WalletSigner,
  files: File[],
  metadata: any,
): Promise<{
  instructions: TransactionInstruction[];
  signers: Keypair[];
}> => {
  const memo = programIds().memo;

  const instructions: TransactionInstruction[] = [];
  const signers: Keypair[] = [];

  if (wallet.publicKey)
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: AR_SOL_HOLDER_ID,
        lamports: await getAssetCostToStore(files),
      }),
    );

  for (let i = 0; i < files.length; i++) {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(await files[i].text());
    const hex = hashSum.digest('hex');
    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: memo,
        data: Buffer.from(hex),
      }),
    );
  }

  return {
    instructions,
    signers,
  };
};
