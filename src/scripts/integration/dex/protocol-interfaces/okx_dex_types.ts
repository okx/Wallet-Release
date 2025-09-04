/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dex_solana.json`.
 */
export type DexSolana = {
  address: "ZERor4xhbUycZ6gb9ntrhqscUcZmAbQDjEAtCf4hbZY";
  metadata: {
    name: "dexSolana";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "addResolver";
      discriminator: [213, 83, 253, 107, 89, 173, 25, 250];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "resolver";
          type: "pubkey";
        },
      ];
    },
    {
      name: "cancelOrder";
      discriminator: [95, 129, 237, 240, 8, 49, 223, 132];
      accounts: [
        {
          name: "payer";
          docs: ["The payer of the transaction"];
          writable: true;
          signer: true;
        },
        {
          name: "maker";
          writable: true;
        },
        {
          name: "globalConfig";
          docs: ["The global config account"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "orderPda";
          docs: ["The order PDA account"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114, 95, 118, 49];
              },
              {
                kind: "arg";
                path: "orderId";
              },
              {
                kind: "account";
                path: "maker";
              },
            ];
          };
        },
        {
          name: "escrowTokenAccount";
          docs: ["The escrow token account for the order"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                ];
              },
              {
                kind: "account";
                path: "orderPda";
              },
              {
                kind: "account";
                path: "inputTokenMint";
              },
            ];
          };
        },
        {
          name: "inputTokenAccount";
          docs: ["The user token account for input token"];
          writable: true;
        },
        {
          name: "inputTokenMint";
          docs: ["The mint of input token"];
          writable: true;
        },
        {
          name: "inputTokenProgram";
          docs: ["SPL program for input token transfers"];
        },
        {
          name: "instructionsSysvar";
          address: "Sysvar1nstructions1111111111111111111111111";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
        {
          name: "tips";
          type: "u64";
        },
      ];
    },
    {
      name: "commissionFillOrder";
      discriminator: [93, 237, 144, 37, 39, 166, 152, 242];
      accounts: [
        {
          name: "payer";
          docs: ["The payer of the transaction"];
          writable: true;
          signer: true;
        },
        {
          name: "maker";
          writable: true;
        },
        {
          name: "globalConfig";
          docs: ["The global config account"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "inputTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "outputTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "orderPda";
          docs: ["The order PDA account"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114, 95, 118, 49];
              },
              {
                kind: "arg";
                path: "orderId";
              },
              {
                kind: "account";
                path: "maker";
              },
            ];
          };
        },
        {
          name: "escrowTokenAccount";
          docs: ["The escrow token account for the order"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                ];
              },
              {
                kind: "account";
                path: "orderPda";
              },
              {
                kind: "account";
                path: "inputTokenMint";
              },
            ];
          };
        },
        {
          name: "tempInputTokenAccount";
          docs: ["Temp input token account"];
          writable: true;
          optional: true;
        },
        {
          name: "outputTokenAccount";
          docs: ["The user token account for output token"];
          writable: true;
        },
        {
          name: "inputTokenMint";
          docs: ["The mint of input token"];
          writable: true;
        },
        {
          name: "outputTokenMint";
          docs: ["The mint of output token"];
        },
        {
          name: "inputTokenProgram";
        },
        {
          name: "outputTokenProgram";
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
        {
          name: "instructionsSysvar";
          address: "Sysvar1nstructions1111111111111111111111111";
        },
        {
          name: "commissionTokenAccount";
          writable: true;
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
        {
          name: "tips";
          type: "u64";
        },
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionInfo";
          type: "u32";
        },
      ];
    },
    {
      name: "commissionSolFromSwap";
      discriminator: [129, 59, 69, 10, 132, 76, 35, 20];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
          writable: true;
        },
        {
          name: "bridgeProgram";
          address: "okxBd18urPbBi2vsExxUDArzQNcju2DugV9Mt46BxYE";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "token2022Program";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "commissionAccount";
          writable: true;
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionRate";
          type: "u16";
        },
        {
          name: "bridgeToArgs";
          type: {
            defined: {
              name: "bridgeToArgs";
            };
          };
        },
        {
          name: "offset";
          type: "u8";
        },
        {
          name: "len";
          type: "u8";
        },
      ];
    },
    {
      name: "commissionSolProxySwap";
      discriminator: [30, 33, 208, 91, 31, 157, 37, 18];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionAccount";
          writable: true;
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionRate";
          type: "u16";
        },
        {
          name: "commissionDirection";
          type: "bool";
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "commissionSolSwap";
      discriminator: [81, 128, 134, 73, 114, 73, 45, 94];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionAccount";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "commissionSwapArgs";
            };
          };
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "commissionSplFromSwap";
      discriminator: [5, 77, 144, 50, 222, 228, 233, 171];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
          writable: true;
        },
        {
          name: "bridgeProgram";
          address: "okxBd18urPbBi2vsExxUDArzQNcju2DugV9Mt46BxYE";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "token2022Program";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "commissionTokenAccount";
          writable: true;
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionRate";
          type: "u16";
        },
        {
          name: "bridgeToArgs";
          type: {
            defined: {
              name: "bridgeToArgs";
            };
          };
        },
        {
          name: "offset";
          type: "u8";
        },
        {
          name: "len";
          type: "u8";
        },
      ];
    },
    {
      name: "commissionSplProxySwap";
      discriminator: [96, 67, 12, 151, 129, 164, 18, 71];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionTokenAccount";
          writable: true;
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionRate";
          type: "u16";
        },
        {
          name: "commissionDirection";
          type: "bool";
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "commissionSplSwap";
      discriminator: [235, 71, 211, 196, 114, 199, 143, 92];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "commissionSwapArgs";
            };
          };
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "commissionWrapUnwrap";
      discriminator: [12, 73, 156, 71, 233, 172, 189, 197];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "payerWsolAccount";
          writable: true;
        },
        {
          name: "wsolMint";
          address: "So11111111111111111111111111111111111111112";
        },
        {
          name: "tempWsolAccount";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 101, 109, 112, 95, 119, 115, 111, 108];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "commissionSolAccount";
          writable: true;
        },
        {
          name: "commissionWsolAccount";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "commissionWrapUnwrapArgs";
            };
          };
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "fillOrderByResolver";
      discriminator: [176, 206, 126, 248, 50, 215, 39, 44];
      accounts: [
        {
          name: "payer";
          docs: ["The payer of the transaction"];
          writable: true;
          signer: true;
        },
        {
          name: "maker";
          writable: true;
        },
        {
          name: "globalConfig";
          docs: ["The global config account"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "inputTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "outputTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "orderPda";
          docs: ["The order PDA account"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114, 95, 118, 49];
              },
              {
                kind: "arg";
                path: "orderId";
              },
              {
                kind: "account";
                path: "maker";
              },
            ];
          };
        },
        {
          name: "escrowTokenAccount";
          docs: ["The escrow token account for the order"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                ];
              },
              {
                kind: "account";
                path: "orderPda";
              },
              {
                kind: "account";
                path: "inputTokenMint";
              },
            ];
          };
        },
        {
          name: "tempInputTokenAccount";
          docs: ["Temp input token account"];
          writable: true;
          optional: true;
        },
        {
          name: "outputTokenAccount";
          docs: ["The user token account for output token"];
          writable: true;
        },
        {
          name: "inputTokenMint";
          docs: ["The mint of input token"];
          writable: true;
        },
        {
          name: "outputTokenMint";
          docs: ["The mint of output token"];
        },
        {
          name: "inputTokenProgram";
        },
        {
          name: "outputTokenProgram";
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
        {
          name: "instructionsSysvar";
          address: "Sysvar1nstructions1111111111111111111111111";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
        {
          name: "tips";
          type: "u64";
        },
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
      ];
    },
    {
      name: "fromSwapLog";
      discriminator: [133, 186, 15, 105, 31, 76, 31, 112];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
          writable: true;
        },
        {
          name: "bridgeProgram";
          address: "okxBd18urPbBi2vsExxUDArzQNcju2DugV9Mt46BxYE";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "token2022Program";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "bridgeToArgs";
          type: {
            defined: {
              name: "bridgeToArgs";
            };
          };
        },
        {
          name: "offset";
          type: "u8";
        },
        {
          name: "len";
          type: "u8";
        },
      ];
    },
    {
      name: "initGlobalConfig";
      discriminator: [140, 136, 214, 48, 87, 0, 120, 255];
      accounts: [
        {
          name: "admin";
          docs: ["Address to be set as protocol owner."];
          writable: true;
          signer: true;
        },
        {
          name: "globalConfig";
          docs: [
            "Initialize config state account to store protocol owner address and fee rates.",
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "program";
          address: "6m2CDdhRgxpH4WjvdzxAYbGxwdGUz5MziiL5jek2kBma";
        },
        {
          name: "programData";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "tradeFee";
          type: "u64";
        },
      ];
    },
    {
      name: "pause";
      discriminator: [211, 22, 221, 251, 74, 121, 193, 47];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "placeOrder";
      discriminator: [51, 194, 155, 175, 109, 130, 96, 106];
      accounts: [
        {
          name: "maker";
          docs: ["The maker of the order"];
          writable: true;
          signer: true;
        },
        {
          name: "globalConfig";
          docs: ["The global config account"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "orderPda";
          docs: ["The order PDA account"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114, 95, 118, 49];
              },
              {
                kind: "arg";
                path: "orderId";
              },
              {
                kind: "account";
                path: "maker";
              },
            ];
          };
        },
        {
          name: "escrowTokenAccount";
          docs: ["The escrow token account for the order"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                ];
              },
              {
                kind: "account";
                path: "orderPda";
              },
              {
                kind: "account";
                path: "inputTokenMint";
              },
            ];
          };
        },
        {
          name: "inputTokenAccount";
          docs: ["The user token account for input token"];
          writable: true;
        },
        {
          name: "inputTokenMint";
          docs: ["The mint of input token"];
        },
        {
          name: "outputTokenMint";
          docs: ["The mint of output token"];
        },
        {
          name: "inputTokenProgram";
        },
        {
          name: "outputTokenProgram";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
        {
          name: "makingAmount";
          type: "u64";
        },
        {
          name: "expectTakingAmount";
          type: "u64";
        },
        {
          name: "minReturnAmount";
          type: "u64";
        },
        {
          name: "deadline";
          type: "u64";
        },
        {
          name: "tradeFee";
          type: "u64";
        },
      ];
    },
    {
      name: "platformFeeSolProxySwapV2";
      discriminator: [69, 200, 254, 247, 40, 52, 118, 202];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionAccount";
          writable: true;
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionInfo";
          type: "u32";
        },
        {
          name: "platformFeeRate";
          type: "u32";
        },
        {
          name: "trimRate";
          type: "u8";
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "platformFeeSolWrapUnwrapV2";
      discriminator: [196, 172, 152, 92, 60, 186, 64, 227];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "payerWsolAccount";
          writable: true;
        },
        {
          name: "wsolMint";
          address: "So11111111111111111111111111111111111111112";
        },
        {
          name: "tempWsolAccount";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 101, 109, 112, 95, 119, 115, 111, 108];
              },
              {
                kind: "account";
                path: "payer";
              },
            ];
          };
        },
        {
          name: "commissionSolAccount";
          writable: true;
        },
        {
          name: "commissionWsolAccount";
          writable: true;
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "platformFeeWrapUnwrapArgsV2";
            };
          };
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "platformFeeSplProxySwapV2";
      discriminator: [69, 164, 210, 89, 146, 214, 173, 67];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionTokenAccount";
          writable: true;
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionInfo";
          type: "u32";
        },
        {
          name: "platformFeeRate";
          type: "u32";
        },
        {
          name: "trimRate";
          type: "u8";
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "proxySwap";
      discriminator: [19, 44, 130, 148, 72, 56, 44, 238];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "saAuthority";
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 107, 120, 95, 115, 97];
              },
            ];
          };
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "removeResolver";
      discriminator: [87, 90, 193, 60, 246, 119, 62, 88];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "resolver";
          type: "pubkey";
        },
      ];
    },
    {
      name: "setAdmin";
      discriminator: [251, 163, 0, 52, 91, 194, 187, 92];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "admin";
          type: "pubkey";
        },
      ];
    },
    {
      name: "setFeeMultiplier";
      discriminator: [9, 25, 249, 189, 130, 0, 250, 159];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "feeMultiplier";
          type: "u8";
        },
      ];
    },
    {
      name: "setTradeFee";
      discriminator: [209, 92, 87, 185, 19, 29, 112, 91];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "tradeFee";
          type: "u64";
        },
      ];
    },
    {
      name: "swap";
      discriminator: [248, 198, 158, 145, 225, 117, 135, 200];
      accounts: [
        {
          name: "payer";
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "swapTobV3";
      discriminator: [14, 191, 44, 246, 142, 225, 224, 157];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionAccount";
          writable: true;
          optional: true;
        },
        {
          name: "platformFeeAccount";
          writable: true;
          optional: true;
        },
        {
          name: "saAuthority";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionInfo";
          type: "u32";
        },
        {
          name: "trimRate";
          type: "u8";
        },
        {
          name: "platformFeeRate";
          type: "u16";
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "swapV3";
      discriminator: [240, 224, 38, 33, 176, 31, 241, 175];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "sourceTokenAccount";
          writable: true;
        },
        {
          name: "destinationTokenAccount";
          writable: true;
        },
        {
          name: "sourceMint";
        },
        {
          name: "destinationMint";
        },
        {
          name: "commissionAccount";
          writable: true;
          optional: true;
        },
        {
          name: "platformFeeAccount";
          writable: true;
          optional: true;
        },
        {
          name: "saAuthority";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "destinationTokenSa";
          writable: true;
          optional: true;
        },
        {
          name: "sourceTokenProgram";
          optional: true;
        },
        {
          name: "destinationTokenProgram";
          optional: true;
        },
        {
          name: "associatedTokenProgram";
          optional: true;
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          optional: true;
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
        {
          name: "commissionInfo";
          type: "u32";
        },
        {
          name: "platformFeeRate";
          type: "u16";
        },
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "unpause";
      discriminator: [169, 144, 4, 38, 10, 141, 188, 255];
      accounts: [
        {
          name: "admin";
          signer: true;
          relations: ["globalConfig"];
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "updateOrder";
      discriminator: [54, 8, 208, 207, 34, 134, 239, 168];
      accounts: [
        {
          name: "maker";
          writable: true;
          signer: true;
        },
        {
          name: "globalConfig";
          docs: ["The global config account"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "orderPda";
          docs: ["The order PDA account"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114, 95, 118, 49];
              },
              {
                kind: "arg";
                path: "orderId";
              },
              {
                kind: "account";
                path: "maker";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          docs: ["System program"];
          address: "11111111111111111111111111111111";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
        {
          name: "expectTakingAmount";
          type: "u64";
        },
        {
          name: "minReturnAmount";
          type: "u64";
        },
        {
          name: "deadline";
          type: "u64";
        },
        {
          name: "increaseFee";
          type: "u64";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "globalConfig";
      discriminator: [149, 8, 156, 202, 160, 252, 176, 217];
    },
    {
      name: "orderV1";
      discriminator: [253, 98, 95, 208, 51, 199, 159, 88];
    },
  ];
  events: [
    {
      name: "addResolverEvent";
      discriminator: [173, 137, 29, 251, 195, 58, 115, 71];
    },
    {
      name: "cancelOrderEvent";
      discriminator: [174, 66, 141, 17, 4, 224, 162, 77];
    },
    {
      name: "fillOrderEvent";
      discriminator: [37, 51, 197, 130, 53, 15, 99, 18];
    },
    {
      name: "initGlobalConfigEvent";
      discriminator: [195, 252, 133, 149, 47, 126, 107, 231];
    },
    {
      name: "pauseTradingEvent";
      discriminator: [85, 23, 87, 137, 206, 65, 208, 58];
    },
    {
      name: "placeOrderEvent";
      discriminator: [65, 191, 25, 91, 27, 252, 192, 40];
    },
    {
      name: "refundEvent";
      discriminator: [176, 159, 218, 59, 94, 213, 129, 218];
    },
    {
      name: "removeResolverEvent";
      discriminator: [57, 138, 125, 122, 100, 83, 156, 37];
    },
    {
      name: "setAdminEvent";
      discriminator: [240, 117, 204, 254, 89, 150, 132, 94];
    },
    {
      name: "setFeeMultiplierEvent";
      discriminator: [197, 91, 90, 165, 244, 201, 13, 154];
    },
    {
      name: "setTradeFeeEvent";
      discriminator: [8, 97, 163, 68, 79, 99, 134, 229];
    },
    {
      name: "swapEvent";
      discriminator: [64, 198, 205, 232, 38, 8, 113, 226];
    },
    {
      name: "updateOrderEvent";
      discriminator: [55, 24, 47, 240, 105, 245, 30, 135];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "tooManyHops";
      msg: "Too many hops";
    },
    {
      code: 6001;
      name: "minReturnNotReached";
      msg: "Min return not reached";
    },
    {
      code: 6002;
      name: "amountInMustBeGreaterThanZero";
      msg: "amount_in must be greater than 0";
    },
    {
      code: 6003;
      name: "minReturnMustBeGreaterThanZero";
      msg: "min_return must be greater than 0";
    },
    {
      code: 6004;
      name: "invalidExpectAmountOut";
      msg: "invalid expect amount out";
    },
    {
      code: 6005;
      name: "amountsAndRoutesMustHaveTheSameLength";
      msg: "amounts and routes must have the same length";
    },
    {
      code: 6006;
      name: "totalAmountsMustBeEqualToAmountIn";
      msg: "total_amounts must be equal to amount_in";
    },
    {
      code: 6007;
      name: "dexesAndWeightsMustHaveTheSameLength";
      msg: "dexes and weights must have the same length";
    },
    {
      code: 6008;
      name: "weightsMustSumTo100";
      msg: "weights must sum to 100";
    },
    {
      code: 6009;
      name: "invalidSourceTokenAccount";
      msg: "Invalid source token account";
    },
    {
      code: 6010;
      name: "invalidDestinationTokenAccount";
      msg: "Invalid destination token account";
    },
    {
      code: 6011;
      name: "invalidTokenAccount";
      msg: "Invalid token account";
    },
    {
      code: 6012;
      name: "invalidCommissionRate";
      msg: "Invalid commission rate";
    },
    {
      code: 6013;
      name: "invalidTrimRate";
      msg: "Invalid trim rate";
    },
    {
      code: 6014;
      name: "invalidCommissionTokenAccount";
      msg: "Invalid commission token account";
    },
    {
      code: 6015;
      name: "invalidCommissionTemporaryTokenAccount";
      msg: "Invalid commission temporary token account";
    },
    {
      code: 6016;
      name: "invalidAccountsLength";
      msg: "Invalid accounts length";
    },
    {
      code: 6017;
      name: "invalidHopAccounts";
      msg: "Invalid hop accounts";
    },
    {
      code: 6018;
      name: "invalidHopFromAccount";
      msg: "Invalid hop from account";
    },
    {
      code: 6019;
      name: "swapAuthorityIsNotSigner";
      msg: "Swap authority is not signer";
    },
    {
      code: 6020;
      name: "invalidAuthorityPda";
      msg: "Invalid authority pda";
    },
    {
      code: 6021;
      name: "invalidSwapAuthority";
      msg: "Invalid swap authority";
    },
    {
      code: 6022;
      name: "invalidProgramId";
      msg: "Invalid program id";
    },
    {
      code: 6023;
      name: "invalidPool";
      msg: "Invalid pool";
    },
    {
      code: 6024;
      name: "invalidTokenMint";
      msg: "Invalid token mint";
    },
    {
      code: 6025;
      name: "calculationError";
      msg: "Calculation error";
    },
    {
      code: 6026;
      name: "invalidSanctumLstStateListData";
      msg: "Invalid sanctum lst state list data";
    },
    {
      code: 6027;
      name: "invalidSanctumLstStateListIndex";
      msg: "Invalid sanctum lst state list index";
    },
    {
      code: 6028;
      name: "invalidSanctumSwapAccounts";
      msg: "Invalid sanctum swap accounts";
    },
    {
      code: 6029;
      name: "invalidSwapAuthorityAccounts";
      msg: "Invalid swap authority account";
    },
    {
      code: 6030;
      name: "invalidBridgeSeed";
      msg: "Bridge Seed Error";
    },
    {
      code: 6031;
      name: "invalidBundleInput";
      msg: "Invalid accounts and instruction length";
    },
    {
      code: 6032;
      name: "missingSaAccount";
      msg: "SA is required";
    },
    {
      code: 6033;
      name: "invalidPlatformFeeRate";
      msg: "Invalid platform fee rate";
    },
    {
      code: 6034;
      name: "amountOutMustBeGreaterThanZero";
      msg: "Amount out must be greater than 0";
    },
    {
      code: 6035;
      name: "invalidDampingTerm";
      msg: "Invalid DampingTerm";
    },
    {
      code: 6036;
      name: "invalidMint";
      msg: "Invalid mint";
    },
    {
      code: 6037;
      name: "invalidPlatformFeeAmount";
      msg: "Invalid platform fee amount";
    },
    {
      code: 6038;
      name: "invalidFeeTokenAccount";
      msg: "Invalid fee token account";
    },
    {
      code: 6039;
      name: "invalidSaAuthority";
      msg: "Invalid sa authority";
    },
    {
      code: 6040;
      name: "commissionAccountIsNone";
      msg: "Commission account is none";
    },
    {
      code: 6041;
      name: "platformFeeAccountIsNone";
      msg: "Platform fee account is none";
    },
    {
      code: 6042;
      name: "trimAccountIsNone";
      msg: "Trim account is none";
    },
    {
      code: 6043;
      name: "invalidFeeAccount";
      msg: "Invalid fee account";
    },
    {
      code: 6044;
      name: "invalidSourceTokenSa";
      msg: "Invalid source token sa";
    },
    {
      code: 6045;
      name: "saAuthorityIsNone";
      msg: "Sa authority is none";
    },
    {
      code: 6046;
      name: "sourceTokenSaIsNone";
      msg: "Source token sa is none";
    },
    {
      code: 6047;
      name: "sourceTokenProgramIsNone";
      msg: "Source token program is none";
    },
    {
      code: 6048;
      name: "destinationTokenSaIsNone";
      msg: "Destination token sa is none";
    },
    {
      code: 6049;
      name: "destinationTokenProgramIsNone";
      msg: "Destination token program is none";
    },
    {
      code: 6050;
      name: "resultMustBeGreaterThanZero";
      msg: "Calculation result must be greater than zero";
    },
    {
      code: 6051;
      name: "invalidAccountData";
      msg: "Invalid account data";
    },
    {
      code: 6052;
      name: "invalidRfqParameters";
      msg: "Invalid RFQ parameters";
    },
  ];
  types: [
    {
      name: "adaptorId";
      type: {
        kind: "enum";
        variants: [
          {
            name: "bridge0";
          },
          {
            name: "bridge1";
          },
          {
            name: "bridge2";
          },
          {
            name: "bridge3";
          },
          {
            name: "bridge4";
          },
          {
            name: "bridge5";
          },
          {
            name: "bridge6";
          },
          {
            name: "bridge7";
          },
          {
            name: "bridge8";
          },
          {
            name: "bridge9";
          },
          {
            name: "bridge10";
          },
          {
            name: "bridge11";
          },
          {
            name: "bridge12";
          },
          {
            name: "bridge13";
          },
          {
            name: "bridge14";
          },
          {
            name: "bridge15";
          },
          {
            name: "bridge16";
          },
          {
            name: "bridge17";
          },
          {
            name: "cctp";
          },
          {
            name: "bridge19";
          },
          {
            name: "bridge20";
          },
          {
            name: "wormhole";
          },
          {
            name: "meson";
          },
          {
            name: "bridge23";
          },
          {
            name: "bridge24";
          },
          {
            name: "bridge25";
          },
          {
            name: "bridge26";
          },
          {
            name: "bridge27";
          },
          {
            name: "bridge28";
          },
          {
            name: "bridge29";
          },
          {
            name: "bridge30";
          },
          {
            name: "bridge31";
          },
          {
            name: "bridge32";
          },
          {
            name: "bridge33";
          },
          {
            name: "debridgedln";
          },
          {
            name: "bridge35";
          },
          {
            name: "bridge36";
          },
          {
            name: "bridge37";
          },
          {
            name: "bridge38";
          },
          {
            name: "bridge39";
          },
          {
            name: "bridge40";
          },
          {
            name: "allbridge";
          },
          {
            name: "bridge42";
          },
          {
            name: "bridge43";
          },
          {
            name: "bridge44";
          },
          {
            name: "bridge45";
          },
          {
            name: "bridge46";
          },
          {
            name: "mayanSwift";
          },
          {
            name: "bridge48";
          },
          {
            name: "bridge49";
          },
        ];
      };
    },
    {
      name: "addResolverEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "resolver";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "bridgeToArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "adaptorId";
            type: {
              defined: {
                name: "adaptorId";
              };
            };
          },
          {
            name: "to";
            type: "bytes";
          },
          {
            name: "orderId";
            type: "u64";
          },
          {
            name: "toChainId";
            type: "u64";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "data";
            type: "bytes";
          },
          {
            name: "extData";
            type: "bytes";
          },
        ];
      };
    },
    {
      name: "cancelOrderEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderId";
            type: "u64";
          },
          {
            name: "payer";
            type: "pubkey";
          },
          {
            name: "maker";
            type: "pubkey";
          },
          {
            name: "updateTs";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "commissionSwapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "expectAmountOut";
            type: "u64";
          },
          {
            name: "minReturn";
            type: "u64";
          },
          {
            name: "amounts";
            type: {
              vec: "u64";
            };
          },
          {
            name: "routes";
            type: {
              vec: {
                vec: {
                  defined: {
                    name: "route";
                  };
                };
              };
            };
          },
          {
            name: "commissionRate";
            type: "u16";
          },
          {
            name: "commissionDirection";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "commissionWrapUnwrapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "wrapDirection";
            type: "bool";
          },
          {
            name: "commissionRate";
            type: "u16";
          },
          {
            name: "commissionDirection";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "dex";
      type: {
        kind: "enum";
        variants: [
          {
            name: "splTokenSwap";
          },
          {
            name: "stableSwap";
          },
          {
            name: "whirlpool";
          },
          {
            name: "meteoraDynamicpool";
          },
          {
            name: "raydiumSwap";
          },
          {
            name: "raydiumStableSwap";
          },
          {
            name: "raydiumClmmSwap";
          },
          {
            name: "aldrinExchangeV1";
          },
          {
            name: "aldrinExchangeV2";
          },
          {
            name: "lifinityV1";
          },
          {
            name: "lifinityV2";
          },
          {
            name: "raydiumClmmSwapV2";
          },
          {
            name: "fluxBeam";
          },
          {
            name: "meteoraDlmm";
          },
          {
            name: "raydiumCpmmSwap";
          },
          {
            name: "openBookV2";
          },
          {
            name: "whirlpoolV2";
          },
          {
            name: "phoenix";
          },
          {
            name: "obricV2";
          },
          {
            name: "sanctumAddLiq";
          },
          {
            name: "sanctumRemoveLiq";
          },
          {
            name: "sanctumNonWsolSwap";
          },
          {
            name: "sanctumWsolSwap";
          },
          {
            name: "pumpfunBuy";
          },
          {
            name: "pumpfunSell";
          },
          {
            name: "stabbleSwap";
          },
          {
            name: "sanctumRouter";
          },
          {
            name: "meteoraVaultDeposit";
          },
          {
            name: "meteoraVaultWithdraw";
          },
          {
            name: "saros";
          },
          {
            name: "meteoraLst";
          },
          {
            name: "solfi";
          },
          {
            name: "qualiaSwap";
          },
          {
            name: "zerofi";
          },
          {
            name: "pumpfunammBuy";
          },
          {
            name: "pumpfunammSell";
          },
          {
            name: "virtuals";
          },
          {
            name: "vertigoBuy";
          },
          {
            name: "vertigoSell";
          },
          {
            name: "perpetualsAddLiq";
          },
          {
            name: "perpetualsRemoveLiq";
          },
          {
            name: "perpetualsSwap";
          },
          {
            name: "raydiumLaunchpad";
          },
          {
            name: "letsBonkFun";
          },
          {
            name: "woofi";
          },
          {
            name: "meteoraDbc";
          },
          {
            name: "meteoraDlmmSwap2";
          },
          {
            name: "meteoraDammv2";
          },
          {
            name: "gavel";
          },
          {
            name: "boopfunBuy";
          },
          {
            name: "boopfunSell";
          },
          {
            name: "meteoraDbc2";
          },
          {
            name: "gooseFx";
          },
          {
            name: "dooar";
          },
          {
            name: "numeraire";
          },
          {
            name: "saberDecimalWrapperDeposit";
          },
          {
            name: "saberDecimalWrapperWithdraw";
          },
          {
            name: "sarosDlmm";
          },
          {
            name: "oneDexSwap";
          },
          {
            name: "manifest";
          },
          {
            name: "byrealClmm";
          },
          {
            name: "pancakeSwapV3Swap";
          },
          {
            name: "pancakeSwapV3SwapV2";
          },
          {
            name: "tessera";
          },
          {
            name: "solRfq";
          },
        ];
      };
    },
    {
      name: "fillOrderEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderId";
            type: "u64";
          },
          {
            name: "payer";
            type: "pubkey";
          },
          {
            name: "maker";
            type: "pubkey";
          },
          {
            name: "inputTokenMint";
            type: "pubkey";
          },
          {
            name: "outputTokenMint";
            type: "pubkey";
          },
          {
            name: "makingAmount";
            type: "u64";
          },
          {
            name: "takingAmount";
            type: "u64";
          },
          {
            name: "updateTs";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "globalConfig";
      serialization: "bytemuckunsafe";
      repr: {
        kind: "rust";
        packed: true;
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            docs: ["Bump to identify PDA."];
            type: "u8";
          },
          {
            name: "admin";
            docs: ["The admin of the program."];
            type: "pubkey";
          },
          {
            name: "resolvers";
            docs: ["Only the resolver can trigger order filled."];
            type: {
              array: ["pubkey", 5];
            };
          },
          {
            name: "tradeFee";
            docs: [
              "Prepaid trade fee, the remaining amount will be refunded to the user",
            ];
            type: "u64";
          },
          {
            name: "paused";
            docs: ["Indicate whether to pause trading."];
            type: "bool";
          },
          {
            name: "feeMultiplier";
            docs: ["Fee multiplier for the trade fee"];
            type: "u8";
          },
          {
            name: "padding";
            docs: ["padding for upgrade"];
            type: {
              array: ["u8", 127];
            };
          },
        ];
      };
    },
    {
      name: "initGlobalConfigEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "tradeFee";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "orderV1";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            docs: ["Bump to identify PDA."];
            type: "u8";
          },
          {
            name: "orderId";
            docs: ["The order id."];
            type: "u64";
          },
          {
            name: "maker";
            docs: ["The maker of the order."];
            type: "pubkey";
          },
          {
            name: "makingAmount";
            docs: ["The makeing amount of the order."];
            type: "u64";
          },
          {
            name: "expectTakingAmount";
            docs: ["The expect taking amount of the order."];
            type: "u64";
          },
          {
            name: "minReturnAmount";
            docs: ["The min return amount of the order."];
            type: "u64";
          },
          {
            name: "escrowTokenAccount";
            docs: ["The escrow token account of the order."];
            type: "pubkey";
          },
          {
            name: "inputTokenMint";
            docs: ["Input token mint."];
            type: "pubkey";
          },
          {
            name: "outputTokenMint";
            docs: ["Output token mint."];
            type: "pubkey";
          },
          {
            name: "inputTokenProgram";
            docs: ["Input token program."];
            type: "pubkey";
          },
          {
            name: "outputTokenProgram";
            docs: ["Output token program."];
            type: "pubkey";
          },
          {
            name: "createTs";
            docs: ["The create timestamp of the order."];
            type: "u64";
          },
          {
            name: "deadline";
            docs: ["The deadline of the order."];
            type: "u64";
          },
          {
            name: "padding";
            docs: ["padding"];
            type: {
              array: ["u8", 128];
            };
          },
        ];
      };
    },
    {
      name: "pauseTradingEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "paused";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "placeOrderEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderId";
            type: "u64";
          },
          {
            name: "maker";
            type: "pubkey";
          },
          {
            name: "inputTokenMint";
            type: "pubkey";
          },
          {
            name: "outputTokenMint";
            type: "pubkey";
          },
          {
            name: "makingAmount";
            type: "u64";
          },
          {
            name: "expectTakingAmount";
            type: "u64";
          },
          {
            name: "minReturnAmount";
            type: "u64";
          },
          {
            name: "createTs";
            type: "u64";
          },
          {
            name: "deadline";
            type: "u64";
          },
          {
            name: "tradeFee";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "platformFeeWrapUnwrapArgsV2";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "commissionInfo";
            type: "u32";
          },
          {
            name: "platformFeeRate";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "refundEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderId";
            type: "u64";
          },
          {
            name: "maker";
            type: "pubkey";
          },
          {
            name: "inputTokenMint";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "removeResolverEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "resolver";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "route";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dexes";
            type: {
              vec: {
                defined: {
                  name: "dex";
                };
              };
            };
          },
          {
            name: "weights";
            type: "bytes";
          },
        ];
      };
    },
    {
      name: "setAdminEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "admin";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "setFeeMultiplierEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "feeMultiplier";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "setTradeFeeEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tradeFee";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "swapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "expectAmountOut";
            type: "u64";
          },
          {
            name: "minReturn";
            type: "u64";
          },
          {
            name: "amounts";
            type: {
              vec: "u64";
            };
          },
          {
            name: "routes";
            type: {
              vec: {
                vec: {
                  defined: {
                    name: "route";
                  };
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "swapEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dex";
            type: {
              defined: {
                name: "dex";
              };
            };
          },
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "amountOut";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "swapType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "bridge";
          },
          {
            name: "swapandbridge";
          },
        ];
      };
    },
    {
      name: "updateOrderEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderId";
            type: "u64";
          },
          {
            name: "maker";
            type: "pubkey";
          },
          {
            name: "expectTakingAmount";
            type: "u64";
          },
          {
            name: "minReturnAmount";
            type: "u64";
          },
          {
            name: "deadline";
            type: "u64";
          },
          {
            name: "updateTs";
            type: "u64";
          },
          {
            name: "increaseFee";
            type: "u64";
          },
        ];
      };
    },
  ];
  constants: [
    {
      name: "seedSa";
      type: "bytes";
      value: "[111, 107, 120, 95, 115, 97]";
    },
  ];
};
