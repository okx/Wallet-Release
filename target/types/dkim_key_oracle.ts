export type DkimKeyOracle = {
  "address": "FXo8XW4G5qTzR9G4EnRcQGDBwJ2EciWfni57gV2pLL7w",
  "metadata": {
    "name": "dkim_key_oracle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancel_proposal",
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
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "DkimProposal"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rent_payer",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "change_admin",
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
          "name": "rent_payer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "new_admin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "execute_add",
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
          "name": "dkim_entry",
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
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "DkimProposal"
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
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "DkimProposal"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rent_payer",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "execute_delete",
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
          "name": "dkim_entry",
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
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "DkimProposal"
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
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.domain_hash",
                "account": "DkimProposal"
              },
              {
                "kind": "account",
                "path": "proposal.key_hash",
                "account": "DkimProposal"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rent_payer",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "grant_role",
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
          "name": "rent_payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "member",
          "type": {
            "defined": {
              "name": "Member"
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
          "name": "program_data"
        },
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "rent_payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "initial_timelock",
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
                "path": "proposal_type"
              },
              {
                "kind": "arg",
                "path": "domain_hash"
              },
              {
                "kind": "arg",
                "path": "key_hash"
              }
            ]
          }
        },
        {
          "name": "member",
          "signer": true
        },
        {
          "name": "rent_payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "ProposeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "revoke_admin",
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
      "name": "revoke_role",
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
          "name": "system_program",
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
      "name": "DkimEntry",
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
      "name": "DkimOracleConfig",
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
      "name": "DkimProposal",
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
      "name": "AdminChanged",
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
      "name": "AdminRevoked",
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
      "name": "DkimKeyAdded",
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
      "name": "DkimKeyRemoved",
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
      "name": "OracleInitialized",
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
      "name": "ProposalCancelled",
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
      "name": "ProposalCreated",
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
      "name": "RoleGranted",
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
      "name": "RoleRevoked",
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
      "name": "TimelockNotExpired",
      "msg": "Timelock has not yet expired"
    },
    {
      "code": 6001,
      "name": "InvalidProposalType",
      "msg": "Invalid proposal type"
    },
    {
      "code": 6002,
      "name": "NotAdmin",
      "msg": "Not admin"
    },
    {
      "code": 6003,
      "name": "InvalidAdmin",
      "msg": "Invalid admin"
    },
    {
      "code": 6004,
      "name": "NotAMember",
      "msg": "Not a member"
    },
    {
      "code": 6005,
      "name": "DuplicateMember",
      "msg": "Duplicate member"
    },
    {
      "code": 6006,
      "name": "NotProposer",
      "msg": "Not a proposer"
    },
    {
      "code": 6007,
      "name": "NotExecutor",
      "msg": "Not an executor"
    },
    {
      "code": 6008,
      "name": "NotCanceller",
      "msg": "Not a canceller"
    }
  ],
  "types": [
    {
      "name": "AdminChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "old_admin",
            "type": "pubkey"
          },
          {
            "name": "new_admin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "AdminRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "revoked_admin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "DkimEntry",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "DkimKeyAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "domain_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "key_hash",
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
      "name": "DkimKeyRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "domain_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "key_hash",
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
      "name": "DkimOracleConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timelock_duration",
            "type": "u64"
          },
          {
            "name": "members",
            "type": {
              "vec": {
                "defined": {
                  "name": "Member"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "DkimProposal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal_type",
            "type": {
              "defined": {
                "name": "ProposalType"
              }
            }
          },
          {
            "name": "domain_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "key_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "propose_time",
            "type": "u64"
          },
          {
            "name": "rent_payer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "Member",
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
                "name": "Permissions"
              }
            }
          }
        ]
      }
    },
    {
      "name": "OracleInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timelock_duration",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Permissions",
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
      "name": "ProposalCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal_type",
            "type": {
              "defined": {
                "name": "ProposalType"
              }
            }
          },
          {
            "name": "domain_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "key_hash",
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
      "name": "ProposalCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal_type",
            "type": {
              "defined": {
                "name": "ProposalType"
              }
            }
          },
          {
            "name": "domain_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "key_hash",
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
      "name": "ProposalType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Add"
          },
          {
            "name": "Remove"
          }
        ]
      }
    },
    {
      "name": "ProposeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal_type",
            "type": {
              "defined": {
                "name": "ProposalType"
              }
            }
          },
          {
            "name": "domain_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "key_hash",
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
      "name": "RoleGranted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "member",
            "type": {
              "defined": {
                "name": "Member"
              }
            }
          }
        ]
      }
    },
    {
      "name": "RoleRevoked",
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
}