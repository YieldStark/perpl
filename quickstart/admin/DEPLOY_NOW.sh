#!/bin/bash

# Deploy PositionHandler with the newly declared class hash
cd quickstart/contracts

sncast deploy \
  --class-hash 0x619ea7d839496351cc4dc99aa5d9c961cbfa4f40c03fb5d1bb78e9a201fe3a8 \
  --constructor-calldata \
    0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
    0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda \
    0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d

