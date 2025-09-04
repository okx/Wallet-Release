/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zk_email_verifier.json`.
 */
export type ZkEmailVerifier = {
  "address": "5ZWpsrh3afwUcbuiX6m1LwCriFFqtKnTf8DkJjvUfYb9",
  "metadata": {
    "name": "zkEmailVerifier",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
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
          "name": "recoverySigner",
          "signer": true
        },
        {
          "name": "feeRecipient",
          "writable": true
        },
        {
          "name": "zkVerifierAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  122,
                  107,
                  95,
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114
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
          "name": "smartAccountProgram"
        },
        {
          "name": "smartAccountConfig",
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
            ],
            "program": {
              "kind": "account",
              "path": "smartAccountProgram"
            }
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
                "kind": "account",
                "path": "vault_state.id",
                "account": "vaultState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "smartAccountProgram"
            }
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
                "path": "vault_state.id",
                "account": "vaultState"
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
          "name": "entryPda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "emailInfo"
              },
              {
                "kind": "arg",
                "path": "email_info.dkim_pubkey_hash"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                215,
                231,
                51,
                72,
                97,
                64,
                227,
                128,
                118,
                59,
                19,
                144,
                34,
                216,
                245,
                19,
                250,
                237,
                33,
                41,
                189,
                32,
                109,
                159,
                98,
                193,
                194,
                189,
                57,
                241,
                234,
                70
              ]
            }
          }
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "emailInfo",
          "type": {
            "defined": {
              "name": "emailInfo"
            }
          }
        },
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "proof"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "dkimEntry",
      "discriminator": [
        92,
        252,
        178,
        13,
        38,
        23,
        186,
        239
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
      "name": "programIdMismatch",
      "msg": "Program ID mismatch"
    },
    {
      "code": 6001,
      "name": "failedVerifierInit",
      "msg": "Failed to initialize verifier"
    },
    {
      "code": 6002,
      "name": "failedVerification",
      "msg": "Failed verification"
    },
    {
      "code": 6003,
      "name": "invalidVaultProgram",
      "msg": "Invalid vault program"
    },
    {
      "code": 6004,
      "name": "invalidSmartAccountProgram",
      "msg": "Invalid smart account program"
    }
  ],
  "types": [
    {
      "name": "dkimEntry",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "emailInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "emailDomain",
            "type": "string"
          },
          {
            "name": "dkimPubkeyHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "emailNullifer",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "emailHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
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
            "name": "timestamp",
            "type": "u64"
          },
          {
            "name": "timestampStr",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "proof",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proofA",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "proofB",
            "type": {
              "array": [
                "u8",
                128
              ]
            }
          },
          {
            "name": "proofC",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
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
