/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/smart_account_solana.json`.
 */
export type SmartAccountSolana = {
  "address": "DXkuJYJfne9v7vc85361VvdhGezJ6ynMA6oLXYC4qiSp",
  "metadata": {
    "name": "smartAccountSolana",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addRecoverySigner",
      "discriminator": [
        189,
        255,
        95,
        64,
        23,
        84,
        192,
        1
      ],
      "accounts": [
        {
          "name": "smartAccountVault",
          "writable": true,
          "signer": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                203,
                190,
                52,
                25,
                56,
                17,
                59,
                176,
                107,
                41,
                126,
                139,
                85,
                173,
                172,
                69,
                111,
                238,
                52,
                23,
                74,
                155,
                54,
                89,
                107,
                94,
                63,
                82,
                112,
                153,
                199,
                66
              ]
            }
          }
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "recoverySigner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "addSigner",
      "discriminator": [
        76,
        104,
        61,
        51,
        179,
        139,
        47,
        222
      ],
      "accounts": [
        {
          "name": "smartAccountVault",
          "writable": true,
          "signer": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                203,
                190,
                52,
                25,
                56,
                17,
                59,
                176,
                107,
                41,
                126,
                139,
                85,
                173,
                172,
                69,
                111,
                238,
                52,
                23,
                74,
                155,
                54,
                89,
                107,
                94,
                63,
                82,
                112,
                153,
                199,
                66
              ]
            }
          }
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "signer",
          "type": {
            "defined": {
              "name": "signerType"
            }
          }
        }
      ]
    },
    {
      "name": "addWebauthnTableEntry",
      "discriminator": [
        169,
        47,
        219,
        73,
        136,
        66,
        85,
        204
      ],
      "accounts": [
        {
          "name": "webauthnModerator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "webauthnTable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  101,
                  98,
                  97,
                  117,
                  116,
                  104,
                  110,
                  95,
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "webauthn_table.table_index",
                "account": "webauthnTable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "addWebauthnTableEntryArgs"
            }
          }
        }
      ]
    },
    {
      "name": "closeAndMigrate",
      "discriminator": [
        135,
        3,
        181,
        41,
        164,
        3,
        156,
        50
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "solanaSigner",
          "signer": true,
          "optional": true
        },
        {
          "name": "smartAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ]
          }
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultConfig"
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "smartAccountVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "newDelegatedProgram"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "webauthnTable",
          "optional": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "ixData",
          "type": "bytes"
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "webauthnArgs",
          "type": {
            "option": {
              "defined": {
                "name": "webAuthnArgs"
              }
            }
          }
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "closeWebauthnTable",
      "discriminator": [
        146,
        36,
        235,
        132,
        145,
        96,
        5,
        180
      ],
      "accounts": [
        {
          "name": "webauthnModerator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "webauthnTable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  101,
                  98,
                  97,
                  117,
                  116,
                  104,
                  110,
                  95,
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "webauthn_table.table_index",
                "account": "webauthnTable"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createGeneralAccount",
      "discriminator": [
        108,
        46,
        28,
        116,
        213,
        6,
        45,
        102
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "smartAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultConfig"
        },
        {
          "name": "smartAccountVault",
          "writable": true
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        },
        {
          "name": "webauthnTable",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createGeneralAccountArgs"
            }
          }
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "webauthnArgs",
          "type": {
            "option": {
              "defined": {
                "name": "webAuthnArgs"
              }
            }
          }
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "createPayAccount",
      "discriminator": [
        55,
        253,
        165,
        130,
        161,
        140,
        116,
        223
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "creator",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "smartAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args.id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultConfig"
        },
        {
          "name": "smartAccountVault",
          "writable": true
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        },
        {
          "name": "webauthnTable",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createPayAccountArgs"
            }
          }
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "webauthnArgs",
          "type": {
            "defined": {
              "name": "webAuthnArgs"
            }
          }
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "createWebauthnTable",
      "discriminator": [
        155,
        58,
        219,
        186,
        130,
        237,
        7,
        76
      ],
      "accounts": [
        {
          "name": "webauthnModerator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "webauthnTable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  101,
                  98,
                  97,
                  117,
                  116,
                  104,
                  110,
                  95,
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "args.table_index"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createWebauthnTableArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Address to be set as protocol owner."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "program",
          "address": "DXkuJYJfne9v7vc85361VvdhGezJ6ynMA6oLXYC4qiSp"
        },
        {
          "name": "programData"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeConfigArgs"
            }
          }
        }
      ]
    },
    {
      "name": "optimisticValidation",
      "discriminator": [
        168,
        232,
        143,
        98,
        225,
        229,
        203,
        67
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "solanaSigner",
          "signer": true,
          "optional": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "webauthnTable",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "validationArgs",
          "type": {
            "defined": {
              "name": "optimisticValidationArgs"
            }
          }
        },
        {
          "name": "webauthnArgs",
          "type": {
            "option": {
              "defined": {
                "name": "webAuthnArgs"
              }
            }
          }
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "postOptimisticExecution",
      "discriminator": [
        127,
        90,
        16,
        72,
        234,
        138,
        33,
        185
      ],
      "accounts": [
        {
          "name": "txPayer",
          "signer": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "jitoTipAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultState"
        },
        {
          "name": "smartAccountVault",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "jitoTipAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "recover",
      "discriminator": [
        108,
        216,
        38,
        58,
        109,
        146,
        116,
        17
      ],
      "accounts": [
        {
          "name": "smartAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ]
          }
        },
        {
          "name": "recoverySigner",
          "signer": true
        },
        {
          "name": "rentPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "passkeyPubkey",
          "type": {
            "array": [
              "u8",
              33
            ]
          }
        }
      ]
    },
    {
      "name": "removeRecoverySigner",
      "discriminator": [
        87,
        70,
        39,
        188,
        229,
        243,
        48,
        105
      ],
      "accounts": [
        {
          "name": "smartAccountVault",
          "writable": true,
          "signer": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                203,
                190,
                52,
                25,
                56,
                17,
                59,
                176,
                107,
                41,
                126,
                139,
                85,
                173,
                172,
                69,
                111,
                238,
                52,
                23,
                74,
                155,
                54,
                89,
                107,
                94,
                63,
                82,
                112,
                153,
                199,
                66
              ]
            }
          }
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "recoverySigner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "removeSigner",
      "discriminator": [
        212,
        32,
        97,
        47,
        61,
        67,
        184,
        141
      ],
      "accounts": [
        {
          "name": "smartAccountVault",
          "writable": true,
          "signer": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                203,
                190,
                52,
                25,
                56,
                17,
                59,
                176,
                107,
                41,
                126,
                139,
                85,
                173,
                172,
                69,
                111,
                238,
                52,
                23,
                74,
                155,
                54,
                89,
                107,
                94,
                63,
                82,
                112,
                153,
                199,
                66
              ]
            }
          }
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "signerIdentifier",
          "type": {
            "defined": {
              "name": "signerIdentifier"
            }
          }
        }
      ]
    },
    {
      "name": "removeWebauthnTableEntry",
      "discriminator": [
        48,
        227,
        57,
        118,
        146,
        235,
        16,
        203
      ],
      "accounts": [
        {
          "name": "webauthnModerator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "webauthnTable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  101,
                  98,
                  97,
                  117,
                  116,
                  104,
                  110,
                  95,
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "webauthn_table.table_index",
                "account": "webauthnTable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "removeWebauthnTableEntryArgs"
            }
          }
        }
      ]
    },
    {
      "name": "revokeAdmin",
      "discriminator": [
        45,
        214,
        156,
        163,
        28,
        217,
        217,
        186
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "simulateCloseAndMigrate",
      "discriminator": [
        186,
        121,
        158,
        183,
        172,
        3,
        158,
        39
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "solanaSigner",
          "signer": true,
          "optional": true
        },
        {
          "name": "smartAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ]
          }
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultConfig"
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "smartAccountVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account.id",
                "account": "smartAccount"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "newDelegatedProgram"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "webauthnTable",
          "optional": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "ixData",
          "type": "bytes"
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "webauthnArgs",
          "type": {
            "option": {
              "defined": {
                "name": "webAuthnArgs"
              }
            }
          }
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "simulateCreatePayAccount",
      "discriminator": [
        66,
        18,
        38,
        71,
        31,
        13,
        22,
        164
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "creator",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "smartAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  109,
                  97,
                  114,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args.id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultConfig"
        },
        {
          "name": "smartAccountVault",
          "writable": true
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        },
        {
          "name": "webauthnTable",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createPayAccountArgs"
            }
          }
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "webauthnArgs",
          "type": {
            "defined": {
              "name": "webAuthnArgs"
            }
          }
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "simulateValidateExecution",
      "discriminator": [
        250,
        151,
        22,
        191,
        129,
        43,
        193,
        145
      ],
      "accounts": [
        {
          "name": "txPayer",
          "signer": true
        },
        {
          "name": "solanaSigner",
          "signer": true,
          "optional": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "smartAccountVault",
          "writable": true
        },
        {
          "name": "systemProgram",
          "optional": true,
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        },
        {
          "name": "webauthnTable",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "webauthnArgs",
          "type": {
            "option": {
              "defined": {
                "name": "webAuthnArgs"
              }
            }
          }
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "simulateValidateOptimisticExecution",
      "discriminator": [
        25,
        26,
        39,
        181,
        18,
        102,
        213,
        7
      ],
      "accounts": [
        {
          "name": "txPayer",
          "signer": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "smartAccountVault"
        }
      ],
      "args": []
    },
    {
      "name": "updateAdmin",
      "discriminator": [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "admin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateCreator",
      "discriminator": [
        39,
        221,
        251,
        213,
        194,
        161,
        31,
        207
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "creator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateMandatorySigner",
      "discriminator": [
        193,
        233,
        95,
        205,
        173,
        146,
        91,
        41
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "smartAccount",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "mandatorySigner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateWebauthnModerator",
      "discriminator": [
        171,
        74,
        71,
        33,
        213,
        143,
        103,
        162
      ],
      "accounts": [
        {
          "name": "txPayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "moderator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "validateExecution",
      "discriminator": [
        151,
        103,
        96,
        183,
        173,
        138,
        255,
        71
      ],
      "accounts": [
        {
          "name": "txPayer",
          "signer": true
        },
        {
          "name": "solanaSigner",
          "signer": true,
          "optional": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "smartAccountVault",
          "writable": true
        },
        {
          "name": "systemProgram",
          "optional": true,
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenMint",
          "optional": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true
        },
        {
          "name": "webauthnTable",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "webauthnArgs",
          "type": {
            "option": {
              "defined": {
                "name": "webAuthnArgs"
              }
            }
          }
        },
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "intentProof",
          "type": {
            "option": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        }
      ]
    },
    {
      "name": "validateOptimisticExecution",
      "discriminator": [
        156,
        136,
        120,
        197,
        85,
        221,
        121,
        127
      ],
      "accounts": [
        {
          "name": "txPayer",
          "signer": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "smartAccountVault"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "smartAccount",
      "discriminator": [
        186,
        83,
        247,
        224,
        59,
        95,
        223,
        112
      ]
    },
    {
      "name": "vaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    },
    {
      "name": "webauthnTable",
      "discriminator": [
        38,
        140,
        37,
        219,
        121,
        58,
        156,
        35
      ]
    }
  ],
  "events": [
    {
      "name": "accountRecovered",
      "discriminator": [
        53,
        125,
        64,
        254,
        83,
        57,
        71,
        84
      ]
    },
    {
      "name": "adminRevoked",
      "discriminator": [
        221,
        50,
        198,
        169,
        2,
        46,
        0,
        73
      ]
    },
    {
      "name": "adminUpdated",
      "discriminator": [
        69,
        82,
        49,
        171,
        43,
        3,
        80,
        161
      ]
    },
    {
      "name": "configInitialized",
      "discriminator": [
        181,
        49,
        200,
        156,
        19,
        167,
        178,
        91
      ]
    },
    {
      "name": "creatorUpdated",
      "discriminator": [
        249,
        128,
        133,
        111,
        137,
        184,
        164,
        83
      ]
    },
    {
      "name": "executionValidated",
      "discriminator": [
        63,
        8,
        130,
        32,
        33,
        102,
        189,
        242
      ]
    },
    {
      "name": "generalSmartAccountCreated",
      "discriminator": [
        83,
        143,
        7,
        133,
        39,
        239,
        182,
        89
      ]
    },
    {
      "name": "mandatorySignerUpdated",
      "discriminator": [
        140,
        61,
        242,
        225,
        61,
        238,
        91,
        191
      ]
    },
    {
      "name": "optimisticExecutionValidated",
      "discriminator": [
        150,
        170,
        122,
        147,
        65,
        113,
        238,
        153
      ]
    },
    {
      "name": "passkeySignerAdded",
      "discriminator": [
        156,
        181,
        176,
        166,
        186,
        207,
        185,
        156
      ]
    },
    {
      "name": "passkeySignerRemoved",
      "discriminator": [
        27,
        170,
        135,
        208,
        200,
        0,
        250,
        35
      ]
    },
    {
      "name": "paySmartAccountCreated",
      "discriminator": [
        34,
        227,
        166,
        2,
        54,
        190,
        247,
        168
      ]
    },
    {
      "name": "postExecution",
      "discriminator": [
        196,
        172,
        116,
        120,
        30,
        130,
        201,
        243
      ]
    },
    {
      "name": "recoverySignerAdded",
      "discriminator": [
        228,
        10,
        73,
        237,
        132,
        158,
        118,
        48
      ]
    },
    {
      "name": "recoverySignerRemoved",
      "discriminator": [
        68,
        47,
        172,
        35,
        129,
        211,
        192,
        15
      ]
    },
    {
      "name": "smartAccountClosed",
      "discriminator": [
        26,
        29,
        96,
        74,
        102,
        210,
        201,
        179
      ]
    },
    {
      "name": "solanaKeySignerAdded",
      "discriminator": [
        17,
        201,
        88,
        128,
        0,
        24,
        227,
        165
      ]
    },
    {
      "name": "solanaKeySignerRemoved",
      "discriminator": [
        4,
        93,
        236,
        125,
        222,
        6,
        45,
        255
      ]
    },
    {
      "name": "webauthnModeratorUpdated",
      "discriminator": [
        51,
        186,
        133,
        133,
        21,
        76,
        79,
        36
      ]
    },
    {
      "name": "webauthnTableClosed",
      "discriminator": [
        73,
        227,
        43,
        19,
        14,
        160,
        83,
        37
      ]
    },
    {
      "name": "webauthnTableCreated",
      "discriminator": [
        51,
        14,
        255,
        6,
        235,
        64,
        172,
        13
      ]
    },
    {
      "name": "webauthnTableEntryAdded",
      "discriminator": [
        88,
        113,
        235,
        25,
        109,
        14,
        240,
        87
      ]
    },
    {
      "name": "webauthnTableEntryRemoved",
      "discriminator": [
        89,
        27,
        124,
        93,
        225,
        224,
        204,
        217
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notCreator",
      "msg": "Smart account creation only through creator"
    },
    {
      "code": 6001,
      "name": "invalidVaultProgram",
      "msg": "Invalid vault program"
    },
    {
      "code": 6002,
      "name": "notAdmin",
      "msg": "Only updated by admin"
    },
    {
      "code": 6003,
      "name": "passkeyAlreadyExists",
      "msg": "Passkey already exists"
    },
    {
      "code": 6004,
      "name": "removingLastPasskey",
      "msg": "Removing last passkey"
    },
    {
      "code": 6005,
      "name": "passkeyNotFound",
      "msg": "Passkey not found"
    },
    {
      "code": 6006,
      "name": "invalidPasskeySession",
      "msg": "Invalid passkey session"
    },
    {
      "code": 6007,
      "name": "invalidSignerSession",
      "msg": "Invalid signer session"
    },
    {
      "code": 6008,
      "name": "recoverySignerNotFound",
      "msg": "Recovery signer not found"
    },
    {
      "code": 6009,
      "name": "recoverySignerAlreadyExists",
      "msg": "Recovery signer already exists"
    },
    {
      "code": 6010,
      "name": "invalidAdmin",
      "msg": "Invalid admin"
    },
    {
      "code": 6011,
      "name": "unauthorizedSigner",
      "msg": "Unauthorized signer"
    },
    {
      "code": 6012,
      "name": "recoveryExpired",
      "msg": "Recovery expired"
    },
    {
      "code": 6013,
      "name": "invalidNonce",
      "msg": "Invalid nonce"
    },
    {
      "code": 6014,
      "name": "invalidRecoveryTimestamp",
      "msg": "Invalid recovery timestamp"
    },
    {
      "code": 6015,
      "name": "invalidTransactionStructure",
      "msg": "Invalid transaction structure"
    },
    {
      "code": 6016,
      "name": "secp256r1IxNotFound",
      "msg": "Secp256r1 instruction not found"
    },
    {
      "code": 6017,
      "name": "invalidVaultIx",
      "msg": "Invalid vault instruction"
    },
    {
      "code": 6018,
      "name": "simulationComplete",
      "msg": "Simulation completed successfully"
    },
    {
      "code": 6019,
      "name": "invalidTransactionInBuffer",
      "msg": "Invalid transaction hash in buffer"
    },
    {
      "code": 6020,
      "name": "bufferAccountNotAuthorizedToBeClosed",
      "msg": "Buffer account not authorized to be closed"
    },
    {
      "code": 6021,
      "name": "missingRequiredAccounts",
      "msg": "Missing required accounts"
    },
    {
      "code": 6022,
      "name": "excessAccounts",
      "msg": "Excess accounts"
    },
    {
      "code": 6023,
      "name": "bufferAccountExpired",
      "msg": "Buffer account expired"
    },
    {
      "code": 6024,
      "name": "restrictedSigner",
      "msg": "Restricted signer"
    },
    {
      "code": 6025,
      "name": "optimisticValidationExpired",
      "msg": "Optimistic validation expired"
    },
    {
      "code": 6026,
      "name": "invalidTransactionHash",
      "msg": "Invalid transaction hash"
    },
    {
      "code": 6027,
      "name": "optimisticTransactionNotExecuted",
      "msg": "Optimistic transaction not executed"
    },
    {
      "code": 6028,
      "name": "invalidMaxSlot",
      "msg": "Invalid max slot"
    },
    {
      "code": 6029,
      "name": "optimisticValidationStateNotInitialized",
      "msg": "Optimistic validation state not initialized"
    },
    {
      "code": 6030,
      "name": "optimisticTransactionAlreadyExecuted",
      "msg": "Optimistic transaction already executed"
    },
    {
      "code": 6031,
      "name": "tokenMintNotInitialized",
      "msg": "Token mint not initialized"
    },
    {
      "code": 6032,
      "name": "requiredOptionalAccountNotFound",
      "msg": "Required optional account not found"
    },
    {
      "code": 6033,
      "name": "tokenTransferArgsNotFound",
      "msg": "Token transfer args not found"
    },
    {
      "code": 6034,
      "name": "invalidSmartAccountType",
      "msg": "Invalid smart account type in arguments"
    },
    {
      "code": 6035,
      "name": "webAuthnArgsNotFound",
      "msg": "Webauthn args not found"
    },
    {
      "code": 6036,
      "name": "invalidAuthorizationModel",
      "msg": "Invalid authorization model"
    },
    {
      "code": 6037,
      "name": "invalidMandatorySigner",
      "msg": "Invalid mandatory signer"
    },
    {
      "code": 6038,
      "name": "mandatorySignerNotFound",
      "msg": "Mandatory signer not found"
    },
    {
      "code": 6039,
      "name": "initialSolanaKeySignerNotFound",
      "msg": "Initial Solana keysigner not found"
    },
    {
      "code": 6040,
      "name": "initialSolanaKeySignerNotAllowed",
      "msg": "Initial Solana keysigner not allowed"
    },
    {
      "code": 6041,
      "name": "solanaKeyNotSupportedInPayMultisig",
      "msg": "Solana key signers not supported in PayMultisig authorization model"
    },
    {
      "code": 6042,
      "name": "solanaKeyNotFound",
      "msg": "Solana key not found"
    },
    {
      "code": 6043,
      "name": "invalidWebAuthnIndex",
      "msg": "Invalid webauthn index"
    },
    {
      "code": 6044,
      "name": "duplicateEntry",
      "msg": "Duplicate entry"
    },
    {
      "code": 6045,
      "name": "entryNotFound",
      "msg": "Entry not found"
    },
    {
      "code": 6046,
      "name": "missingWebAuthnTable",
      "msg": "Missing WebAuthn table"
    },
    {
      "code": 6047,
      "name": "notWebauthnModerator",
      "msg": "Not WebAuthn moderator"
    },
    {
      "code": 6048,
      "name": "invalidTxPayer",
      "msg": "Invalid tx payer"
    },
    {
      "code": 6049,
      "name": "shouldSerializeVaultIxUsingSerializeVaultIx",
      "msg": "Should serialize vault instruction using serialize_vault_ix"
    },
    {
      "code": 6050,
      "name": "invalidRecoverySigner",
      "msg": "Invalid recovery signer"
    },
    {
      "code": 6051,
      "name": "invalidResponseType",
      "msg": "Invalid response type"
    },
    {
      "code": 6052,
      "name": "invalidChallenge",
      "msg": "Invalid challenge"
    },
    {
      "code": 6053,
      "name": "invalidSolTransfer",
      "msg": "Invalid sol transfer"
    },
    {
      "code": 6054,
      "name": "removingLastSigner",
      "msg": "Removing last signer"
    },
    {
      "code": 6055,
      "name": "jitoTipAccountNotFound",
      "msg": "Jito tip account not found when jito tip amount is greater than 0"
    }
  ],
  "types": [
    {
      "name": "accountRecovered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "smartAccount",
            "type": "pubkey"
          },
          {
            "name": "passkey",
            "type": {
              "defined": {
                "name": "passkey"
              }
            }
          }
        ]
      }
    },
    {
      "name": "addWebauthnTableEntryArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entry",
            "type": {
              "defined": {
                "name": "webAuthnTableEntry"
              }
            }
          }
        ]
      }
    },
    {
      "name": "adminRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "revokedAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "adminUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "authorizationModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "payMultisig",
            "fields": [
              {
                "defined": {
                  "name": "payMultisig"
                }
              }
            ]
          },
          {
            "name": "signers",
            "fields": [
              {
                "defined": {
                  "name": "smartAccountSigners"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "clientDataJson",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "direct",
            "fields": [
              "string"
            ]
          },
          {
            "name": "index",
            "fields": [
              {
                "array": [
                  "u8",
                  2
                ]
              }
            ]
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": {
              "array": [
                "u8",
                1
              ]
            }
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "webauthnModerator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "createGeneralAccountArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userPasskey",
            "type": {
              "defined": {
                "name": "passkey"
              }
            }
          },
          {
            "name": "initialSolanaSigner",
            "type": {
              "option": {
                "defined": {
                  "name": "solanaKey"
                }
              }
            }
          },
          {
            "name": "initialRecoverySigner",
            "type": "pubkey"
          },
          {
            "name": "accountType",
            "type": {
              "defined": {
                "name": "smartAccountType"
              }
            }
          },
          {
            "name": "salt",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "createPayAccountArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "userPasskey",
            "type": {
              "defined": {
                "name": "passkey"
              }
            }
          },
          {
            "name": "mandatorySigner",
            "type": "pubkey"
          },
          {
            "name": "initialRecoverySigner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "createWebauthnTableArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableIndex",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "creatorUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "executionValidated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "nonceUsed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "generalSmartAccountCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "smartAccount",
            "type": "pubkey"
          },
          {
            "name": "accountType",
            "type": {
              "defined": {
                "name": "smartAccountType"
              }
            }
          },
          {
            "name": "userPasskey",
            "type": {
              "defined": {
                "name": "passkey"
              }
            }
          },
          {
            "name": "initialSolanaSigner",
            "type": {
              "option": {
                "defined": {
                  "name": "solanaKey"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "initializeConfigArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "webauthnModerator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "mandatorySignerUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "mandatorySigner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "optimisticExecutionValidated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "targetHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonceUsed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "optimisticValidationArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxSlot",
            "type": "u64"
          },
          {
            "name": "targetHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "optimisticValidationState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "maxSlot",
            "type": "u64"
          },
          {
            "name": "targetHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "txPayer",
            "type": "pubkey"
          },
          {
            "name": "validationSlot",
            "type": "u64"
          },
          {
            "name": "isExecuted",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "passkey",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": {
              "array": [
                "u8",
                33
              ]
            }
          },
          {
            "name": "validFrom",
            "type": "u64"
          },
          {
            "name": "validUntil",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "passkeySignerAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "passkey",
            "type": {
              "defined": {
                "name": "passkey"
              }
            }
          }
        ]
      }
    },
    {
      "name": "passkeySignerRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "passkeySigner",
            "type": {
              "array": [
                "u8",
                33
              ]
            }
          }
        ]
      }
    },
    {
      "name": "payMultisig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "threshold",
            "type": "u8"
          },
          {
            "name": "mandatorySigner",
            "type": "pubkey"
          },
          {
            "name": "userSigners",
            "type": {
              "vec": {
                "defined": {
                  "name": "passkey"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "paySmartAccountCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "smartAccount",
            "type": "pubkey"
          },
          {
            "name": "userPasskey",
            "type": {
              "defined": {
                "name": "passkey"
              }
            }
          },
          {
            "name": "mandatorySigner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "postExecution",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "targetHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "jitoTipAmount",
            "type": "u64"
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "recoverySignerAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recoverySigner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "recoverySignerRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recoverySigner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "removeWebauthnTableEntryArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableType",
            "type": {
              "defined": {
                "name": "webAuthnTableType"
              }
            }
          },
          {
            "name": "entryIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "signerIdentifier",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "passkey",
            "fields": [
              {
                "array": [
                  "u8",
                  33
                ]
              }
            ]
          },
          {
            "name": "solanaKey",
            "fields": [
              "pubkey"
            ]
          }
        ]
      }
    },
    {
      "name": "signerType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "passkey",
            "fields": [
              {
                "defined": {
                  "name": "passkey"
                }
              }
            ]
          },
          {
            "name": "solanaKey",
            "fields": [
              {
                "defined": {
                  "name": "solanaKey"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "smartAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": {
              "array": [
                "u8",
                1
              ]
            }
          },
          {
            "name": "accountType",
            "type": {
              "defined": {
                "name": "smartAccountType"
              }
            }
          },
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authorizationModel",
            "type": {
              "defined": {
                "name": "authorizationModel"
              }
            }
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "optimisticValidationState",
            "type": {
              "option": {
                "defined": {
                  "name": "optimisticValidationState"
                }
              }
            }
          },
          {
            "name": "recoverySigners",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "smartAccountClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "smartAccount",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "smartAccountSigners",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "passkeySigners",
            "type": {
              "vec": {
                "defined": {
                  "name": "passkey"
                }
              }
            }
          },
          {
            "name": "solanaKeySigners",
            "type": {
              "vec": {
                "defined": {
                  "name": "solanaKey"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "smartAccountType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "payWallet"
          },
          {
            "name": "easyWallet"
          },
          {
            "name": "ceDeFiWallet"
          }
        ]
      }
    },
    {
      "name": "solanaKey",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "pubkey"
          },
          {
            "name": "validFrom",
            "type": "u64"
          },
          {
            "name": "validUntil",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "solanaKeySignerAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "solanaKey",
            "type": {
              "defined": {
                "name": "solanaKey"
              }
            }
          }
        ]
      }
    },
    {
      "name": "solanaKeySignerRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "solanaKeySigner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "delegatedProgram",
            "type": "pubkey"
          },
          {
            "name": "smartAccount",
            "type": "pubkey"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "stateBump",
            "type": "u8"
          },
          {
            "name": "isValidated",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "webAuthnArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "clientDataJson",
            "type": {
              "defined": {
                "name": "clientDataJson"
              }
            }
          },
          {
            "name": "authData",
            "type": {
              "defined": {
                "name": "webAuthnAuthData"
              }
            }
          }
        ]
      }
    },
    {
      "name": "webAuthnAuthData",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "direct",
            "fields": [
              {
                "array": [
                  "u8",
                  37
                ]
              }
            ]
          },
          {
            "name": "index",
            "fields": [
              "u8"
            ]
          }
        ]
      }
    },
    {
      "name": "webAuthnTableEntry",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "preJson",
            "fields": [
              "string"
            ]
          },
          {
            "name": "postJson",
            "fields": [
              "string"
            ]
          },
          {
            "name": "authData",
            "fields": [
              {
                "array": [
                  "u8",
                  37
                ]
              }
            ]
          }
        ]
      }
    },
    {
      "name": "webAuthnTableType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "preJson"
          },
          {
            "name": "postJson"
          },
          {
            "name": "authData"
          }
        ]
      }
    },
    {
      "name": "webauthnModeratorUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "webauthnModerator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "webauthnTable",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": {
              "array": [
                "u8",
                1
              ]
            }
          },
          {
            "name": "tableIndex",
            "type": "u32"
          },
          {
            "name": "preJsonTable",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "postJsonTable",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "authDataTable",
            "type": {
              "vec": {
                "array": [
                  "u8",
                  37
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "webauthnTableClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "webauthnTable",
            "type": "pubkey"
          },
          {
            "name": "tableIndex",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "webauthnTableCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableIndex",
            "type": "u32"
          },
          {
            "name": "webauthnTable",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "webauthnTableEntryAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "webauthnTable",
            "type": "pubkey"
          },
          {
            "name": "tableIndex",
            "type": "u32"
          },
          {
            "name": "entryIndex",
            "type": "u8"
          },
          {
            "name": "entry",
            "type": {
              "defined": {
                "name": "webAuthnTableEntry"
              }
            }
          }
        ]
      }
    },
    {
      "name": "webauthnTableEntryRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "webauthnTable",
            "type": "pubkey"
          },
          {
            "name": "tableIndex",
            "type": "u32"
          },
          {
            "name": "removedEntry",
            "type": {
              "defined": {
                "name": "webAuthnTableEntry"
              }
            }
          }
        ]
      }
    }
  ]
};
