/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vault.json`.
 */
export type Vault = {
  "address": "va1t8sdGkReA6XFgAeZGXmdQoiEtMirwy4ifLv7yGdH",
  "metadata": {
    "name": "vault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "approveExecution",
      "discriminator": [
        22,
        96,
        20,
        190,
        177,
        12,
        242,
        141
      ],
      "accounts": [
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
                "path": "vault_state.id",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "smartAccount",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createSmartAccountVault",
      "discriminator": [
        105,
        168,
        69,
        225,
        244,
        70,
        193,
        17
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "smartAccountVault"
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "smartAccount",
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "initHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "executeBatch",
      "discriminator": [
        112,
        159,
        211,
        51,
        238,
        70,
        212,
        60
      ],
      "accounts": [
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
                "path": "vault_state.id",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "smartAccountVault",
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
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "batchExecuteArgs"
            }
          }
        }
      ]
    },
    {
      "name": "simulateBatch",
      "discriminator": [
        113,
        167,
        25,
        177,
        186,
        96,
        255,
        194
      ],
      "accounts": [
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
                "path": "vault_state.id",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "smartAccountVault",
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
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "batchExecuteArgs"
            }
          }
        }
      ]
    },
    {
      "name": "upgradeSmartAccount",
      "discriminator": [
        106,
        81,
        49,
        252,
        18,
        246,
        31,
        110
      ],
      "accounts": [
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
                "path": "vault_state.id",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "smartAccount",
          "signer": true
        },
        {
          "name": "updatedProgram"
        }
      ],
      "args": []
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
            ]
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
            ]
          }
        },
        {
          "name": "smartAccount",
          "signer": true
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
    },
    {
      "name": "vaultTransferToken",
      "discriminator": [
        204,
        5,
        67,
        14,
        88,
        73,
        112,
        103
      ],
      "accounts": [
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
            ]
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
            ]
          }
        },
        {
          "name": "smartAccount",
          "signer": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "destinationTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
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
  "events": [
    {
      "name": "executionCompleted",
      "discriminator": [
        86,
        12,
        237,
        100,
        243,
        171,
        227,
        159
      ]
    },
    {
      "name": "smartAccountUpgraded",
      "discriminator": [
        190,
        209,
        156,
        116,
        187,
        197,
        36,
        206
      ]
    },
    {
      "name": "vaultCreated",
      "discriminator": [
        117,
        25,
        120,
        254,
        75,
        236,
        78,
        115
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedSmartAccount",
      "msg": "Unauthorized smart account"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Unauthorized admin"
    },
    {
      "code": 6002,
      "name": "programNotFound",
      "msg": "Program not found"
    },
    {
      "code": 6003,
      "name": "unauthorizedExecution",
      "msg": "Unauthorized execution"
    },
    {
      "code": 6004,
      "name": "missingRequiredAccounts",
      "msg": "Missing required accounts"
    },
    {
      "code": 6005,
      "name": "accountOrderMismatch",
      "msg": "Account order mismatch"
    },
    {
      "code": 6006,
      "name": "invalidProgramAccount",
      "msg": "Invalid program account"
    },
    {
      "code": 6007,
      "name": "programAlreadyAuthorized",
      "msg": "Program already authorized"
    },
    {
      "code": 6008,
      "name": "simulationComplete",
      "msg": "Simulation completed successfully"
    },
    {
      "code": 6009,
      "name": "invalidAccountDerivation",
      "msg": "Invalid account derivation"
    }
  ],
  "types": [
    {
      "name": "batchExecuteArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deconstructedInstructions",
            "type": {
              "vec": {
                "defined": {
                  "name": "deconstructedInstruction"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "deconstructedInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ixData",
            "type": "bytes"
          },
          {
            "name": "accountCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "executionCompleted",
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
            "name": "ixsExecuted",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "smartAccountUpgraded",
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
            "name": "upgradedSmartAccount",
            "type": "pubkey"
          },
          {
            "name": "upgradedProgram",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultCreated",
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
            "name": "vaultState",
            "type": "pubkey"
          },
          {
            "name": "smartAccount",
            "type": "pubkey"
          },
          {
            "name": "smartAccountVault",
            "type": "pubkey"
          },
          {
            "name": "delegatedProgram",
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
    }
  ]
};
