/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dkim_key_oracle.json`.
 */
export type DkimKeyOracle = {
  "address": "FXo8XW4G5qTzR9G4EnRcQGDBwJ2EciWfni57gV2pLL7w",
  "metadata": {
    "name": "dkimKeyOracle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelProposal",
      "discriminator": [
        106,
        74,
        128,
        146,
        19,
        65,
        39,
        23
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_type",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "dkimProposal"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rentPayer",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "changeAdmin",
      "discriminator": [
        193,
        151,
        203,
        161,
        200,
        202,
        32,
        146
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "admin",
          "signer": true
        },
        {
          "name": "rentPayer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "executeAdd",
      "discriminator": [
        185,
        219,
        216,
        168,
        122,
        64,
        53,
        212
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "dkimEntry",
          "writable": true,
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
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "dkimProposal"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_type",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "dkimProposal"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rentPayer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeDelete",
      "discriminator": [
        198,
        254,
        116,
        170,
        144,
        117,
        51,
        229
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "dkimEntry",
          "writable": true,
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
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "dkimProposal"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "proposal.proposal_type",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "dkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "dkimProposal"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rentPayer",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "grantRole",
      "discriminator": [
        218,
        234,
        128,
        15,
        82,
        33,
        236,
        253
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "admin",
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
          "name": "member",
          "type": {
            "defined": {
              "name": "member"
            }
          }
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "address": "FXo8XW4G5qTzR9G4EnRcQGDBwJ2EciWfni57gV2pLL7w"
        },
        {
          "name": "programData"
        },
        {
          "name": "admin",
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
          "name": "initialTimelock",
          "type": "u64"
        }
      ]
    },
    {
      "name": "propose",
      "discriminator": [
        93,
        253,
        82,
        168,
        118,
        33,
        102,
        90
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "proposalType"
              },
              {
                "kind": "arg",
                "path": "domainHash"
              },
              {
                "kind": "arg",
                "path": "keyHash"
              }
            ]
          }
        },
        {
          "name": "member",
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
          "name": "args",
          "type": {
            "defined": {
              "name": "proposeArgs"
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
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "revokeRole",
      "discriminator": [
        179,
        232,
        2,
        180,
        48,
        227,
        82,
        7
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  107,
                  105,
                  109,
                  95,
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
          "name": "admin",
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "member",
          "type": "pubkey"
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
      "name": "dkimOracleConfig",
      "discriminator": [
        77,
        209,
        106,
        247,
        38,
        228,
        183,
        230
      ]
    },
    {
      "name": "dkimProposal",
      "discriminator": [
        32,
        119,
        69,
        118,
        175,
        116,
        153,
        195
      ]
    }
  ],
  "events": [
    {
      "name": "adminChanged",
      "discriminator": [
        232,
        34,
        31,
        226,
        62,
        18,
        19,
        114
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
      "name": "dkimKeyAdded",
      "discriminator": [
        152,
        5,
        11,
        76,
        200,
        47,
        118,
        160
      ]
    },
    {
      "name": "dkimKeyRemoved",
      "discriminator": [
        156,
        197,
        61,
        87,
        141,
        181,
        171,
        137
      ]
    },
    {
      "name": "oracleInitialized",
      "discriminator": [
        42,
        87,
        109,
        208,
        1,
        105,
        101,
        142
      ]
    },
    {
      "name": "proposalCancelled",
      "discriminator": [
        253,
        59,
        104,
        46,
        129,
        78,
        9,
        14
      ]
    },
    {
      "name": "proposalCreated",
      "discriminator": [
        186,
        8,
        160,
        108,
        81,
        13,
        51,
        206
      ]
    },
    {
      "name": "roleGranted",
      "discriminator": [
        220,
        183,
        89,
        228,
        143,
        63,
        246,
        58
      ]
    },
    {
      "name": "roleRevoked",
      "discriminator": [
        167,
        183,
        52,
        229,
        126,
        206,
        62,
        61
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "timelockNotExpired",
      "msg": "Timelock has not yet expired"
    },
    {
      "code": 6001,
      "name": "invalidProposalType",
      "msg": "Invalid proposal type"
    },
    {
      "code": 6002,
      "name": "notAdmin",
      "msg": "Not admin"
    },
    {
      "code": 6003,
      "name": "invalidAdmin",
      "msg": "Invalid admin"
    },
    {
      "code": 6004,
      "name": "notAMember",
      "msg": "Not a member"
    },
    {
      "code": 6005,
      "name": "duplicateMember",
      "msg": "Duplicate member"
    },
    {
      "code": 6006,
      "name": "notProposer",
      "msg": "Not a proposer"
    },
    {
      "code": 6007,
      "name": "notExecutor",
      "msg": "Not an executor"
    },
    {
      "code": 6008,
      "name": "notCanceller",
      "msg": "Not a canceller"
    }
  ],
  "types": [
    {
      "name": "adminChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
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
      "name": "dkimEntry",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "dkimKeyAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyHash",
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
      "name": "dkimKeyRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyHash",
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
      "name": "dkimOracleConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timelockDuration",
            "type": "u64"
          },
          {
            "name": "members",
            "type": {
              "vec": {
                "defined": {
                  "name": "member"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "dkimProposal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalType",
            "type": {
              "defined": {
                "name": "proposalType"
              }
            }
          },
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proposeTime",
            "type": "u64"
          },
          {
            "name": "rentPayer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "member",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "pubkey"
          },
          {
            "name": "permissions",
            "type": {
              "defined": {
                "name": "permissions"
              }
            }
          }
        ]
      }
    },
    {
      "name": "oracleInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timelockDuration",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "permissions",
      "docs": [
        "Bitmask for permissions."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mask",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proposalCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalType",
            "type": {
              "defined": {
                "name": "proposalType"
              }
            }
          },
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyHash",
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
      "name": "proposalCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalType",
            "type": {
              "defined": {
                "name": "proposalType"
              }
            }
          },
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyHash",
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
      "name": "proposalType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "add"
          },
          {
            "name": "remove"
          }
        ]
      }
    },
    {
      "name": "proposeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalType",
            "type": {
              "defined": {
                "name": "proposalType"
              }
            }
          },
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyHash",
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
      "name": "roleGranted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "member",
            "type": {
              "defined": {
                "name": "member"
              }
            }
          }
        ]
      }
    },
    {
      "name": "roleRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "member",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
