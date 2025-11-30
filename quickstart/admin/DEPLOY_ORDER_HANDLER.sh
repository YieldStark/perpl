#!/bin/bash

# OrderHandler is already declared, so we can deploy directly
# Using the existing class hash from previous deployment

cd quickstart/contracts

sncast deploy \
  --class-hash 0x030e79af3f971b89e2430bbbc91f1f389d561fba4dfa71900c5267f57a23dd65 \
  --constructor-calldata \
    0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674 \
    0x016735ce3ca6a4491853a669630615c4bc9dfabe47e8d5e92789363770a8644a

