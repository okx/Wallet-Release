/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/upgrade_mock.json`.
 */
export type UpgradeMock = {
  "address": "tqVoUexaDpW35SukukXhMXhtWC1n1PBJq8riiiBZf8R",
  "metadata": {
    "name": "upgradeMock",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "migrateSmartAccountV1",
      "discriminator": [
        50,
        64,
        147,
        219,
        106,
        8,
        94,
        86
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "smartAccountV1",
          "docs": [
            "Validate this is a legitimate SmartAccountV1 from smart_account_solana program"
          ],
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
                  116
                ]
              },
              {
                "kind": "account",
                "path": "smart_account_v1.id",
                "account": "smartAccountV1"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                106,
                254,
                177,
                7,
                234,
                127,
                32,
                30,
                79,
                197,
                203,
                127,
                230,
                216,
                227,
                83,
                124,
                237,
                99,
                196,
                162,
                145,
                137,
                11,
                156,
                36,
                163,
                88,
                130,
                142,
                114,
                187
              ]
            }
          }
        },
        {
          "name": "smartAccountV2",
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
                "path": "smart_account_v1.id",
                "account": "smartAccountV1"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
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
                "path": "smart_account_v1.id",
                "account": "smartAccountV1"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
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
                "path": "smart_account_v1.id",
                "account": "smartAccountV1"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        }
      ],
      "args": []
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
          "name": "txPayer",
          "signer": true
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "config"
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
                "account": "smartAccountV2"
              }
            ]
          }
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
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
                "account": "smartAccountV2"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "vaultState",
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
                "account": "smartAccountV2"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newPasskey",
          "type": {
            "defined": {
              "name": "passkey"
            }
          }
        },
        {
          "name": "executionFees",
          "type": "u64"
        }
      ]
    },
    {
      "name": "vaultTransferSol",
      "discriminator": [
        42,
        16,
        89,
        84,
        184,
        74,
        224,
        126
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mandatorySigner",
          "signer": true
        },
        {
          "name": "smartAccount",
          "writable": true
        },
        {
          "name": "vaultProgram",
          "address": "EiKypMWbgFmQTSpJJCKkTdBMPkUmu6i5uP3MnragfQQH"
        },
        {
          "name": "vaultState",
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
                "path": "vault_state.id",
                "account": "vaultState"
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
                "path": "vault_state.id",
                "account": "vaultState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "vaultProgram"
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "recipient",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
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
      "name": "smartAccountV2",
      "discriminator": [
        171,
        137,
        32,
        110,
        182,
        244,
        6,
        56
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
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidVaultProgram",
      "msg": "Invalid vault program"
    },
    {
      "code": 6001,
      "name": "invalidNonce",
      "msg": "Invalid nonce"
    }
  ],
  "types": [
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
      "name": "smartAccountV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "executorCount",
            "type": "u32"
          },
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
    }
  ]
};
