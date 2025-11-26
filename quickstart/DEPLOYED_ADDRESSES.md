# Deployed Contract Addresses

## Verifier Contract ✅ DEPLOYED

**Contract Name:** `UltraStarknetZKHonkVerifier`

**Deployed Address:** `0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d`

**Class Hash:** `0xada05f4724bbf3d17a002b8e6ac41e4f3b19b13629f7feb57cb19de07c88`

**Declaration Transaction:** `0x48c6daf7158430d4cab398320518766ea2387f51e161c47e2d3edc82ed7c2f8`

**Deployment Transaction:** `0x068099e4a45f7be76c37ca945729df69355f48284809e3e7916301283efe0489`

**Explorer:** https://explorer-zstarknet.d.karnot.xyz/event/42262_0_0

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use

---

## Next: Deploy Perpetual Contracts

When deploying your perpetual contracts, use this verifier address in the constructor:

```cairo
// Example: PositionHandler constructor
PositionHandler::constructor(
    data_store_address,
    event_emitter_address,
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d,  // ← Verifier address
    yusd_token_address,
    collateral_vault_address
)
```

---

## RoleStore Contract ✅ DEPLOYED

**Contract Name:** `RoleStore`

**Deployed Address:** `0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819`

**Class Hash:** `0x58f785b8fb930e26e3a0e689563ca2b504d45b824edd039f2f1384c9dc54012`

**Declaration Transaction:** `0x38614f96249d2926c3f8136d029cea89d752b463bd53844fec1197e5ae334f9`

**Deployment Transaction:** `0x04c89311124ababc661da1ef6f43f5c9b0cb322d8088e2dd9b5a15bae49860dd`

**Explorer:** https://sepolia.starkscan.co/contract/0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use

---

## EventEmitter Contract ✅ DEPLOYED

**Contract Name:** `EventEmitter`

**Deployed Address:** `0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02`

**Class Hash:** `0x35990d101f035e0e7beb87dbce06a2aac099ff390f0eb47cd825a0cb4ed5152`

**Declaration Transaction:** `0x77dc1fdf11b71cd6f17d8e5d065251c0fc68f605af1873902b99d0023ae43f5`

**Deployment Transaction:** `0x07b8de326d8909bcdf8194e44ef2d75f6c52c2828ea652d0ea5f00bade022f14`

**Explorer:** https://sepolia.starkscan.co/contract/0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use

---

## DataStore Contract ✅ DEPLOYED

**Contract Name:** `DataStore`

**Deployed Address:** `0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e`

**Class Hash:** `0x5689c5f386fb1fb0a11a0cab92cdff1a8627a0d527babd8d972f5efb418a024`

**Declaration Transaction:** `0x45c66c043e4b626729a882dd98eb7184e5c671d8029008b47ed62413206df8e`

**Deployment Transaction:** `0x0605b8cc0501ea7d64c0f0dd4baa74b2b60f52347fded5d49f34b4f08181aaaa`

**Explorer:** https://sepolia.starkscan.co/contract/0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use

---

## MockOracle Contract ✅ DEPLOYED

**Contract Name:** `MockOracle`

**Deployed Address:** `0x00e2c5d520b31762df17b54f339c665a7c4c9fa9e81fd05c40c2e0fce3de47b9`

**Class Hash:** `0x5d1a434c58398d466f07fdda8f4857fdd6c4860af63f23ae86bd5e466c87f69`

**Declaration Transaction:** `0x7d3efc3a689ead01c0c0ea0165246c1141e4ac878d97d8848f926402b3863ea`

**Deployment Transaction:** `0x06e2552addbd869978fe508d108537eae8fd0c586c2bb5d65b85820b27d43c71`

**Explorer:** https://sepolia.starkscan.co/contract/0x00e2c5d520b31762df17b54f339c665a7c4c9fa9e81fd05c40c2e0fce3de47b9

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use (interim feed)

---

## Oracle Contract ✅ DEPLOYED (Mock-backed)

**Contract Name:** `Oracle`

**Deployed Address:** `0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674`

**Class Hash:** `0x454760732aa0cc9dd46ad2c417f19dc23adad6b2d2c635fc3674bea29758464`

**Declaration Transaction:** `0x4f235ba5c7a3fb65dffdd4d73d213cf7c84a1fe4c10945aae747eeb31ae54a5`

**Deployment Transaction:** `0x04e3c2af51541d90cb709af042718c0d72a510cc3928e4f96bcf5314a76d1fd8`

**Explorer:** https://sepolia.starkscan.co/contract/0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Live (pulls data from MockOracle until Pragma feed arrives)

**Latest Price Update (Mock):** `0x068715f95a8c0db3809c2798fe2472291d870dc9b03e1c1521b78435eb31bebf`

---

## CollateralVault Contract ✅ DEPLOYED

**Contract Name:** `CollateralVault`

**Deployed Address:** `0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d`

**Class Hash:** `0x2816788bb7128b7a83da9a8409b7098283f0bb58344bdb5ed32136006a92e5d`

**Declaration Transaction:** `0x4aef58fac2a1ecb44a1b06ada977e98588a3cdb478b467bafcbeb3774230774`

**Deployment Transaction:** `0x03333229f00c88cbfc3ddb92a56f3c5f4cbf330fd06fbc4fd6ed1b170daf4a34`

**Explorer:** https://sepolia.starkscan.co/contract/0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use

**Vault Prefunding Tx:** `0x05438249e76d194874566b6203bb49b3146924e1a6f6682bedf5a011fcfe4a98` (1B yUSD minted to vault)

---

## PositionHandler Contract ✅ DEPLOYED

**Contract Name:** `PositionHandler`

**Deployed Address:** `0x034fefb6137bc137491b2226a362d67a1485496e02e9b261b273f39d7b97aebd`

**Class Hash:** `0x3d8d4ab5791322f1899fab95d2f1f2703bc2f3ca3c1bb71aa704465a99a96df`

**Declaration Transaction:** `0x164a8a5b9ec30dc8999092bb3e9d12723191ee12fc97a7b73e0e59f92056718`

**Deployment Transaction:** `0x055f1b0ce1bb72a1baa1ce7d1650fcdcd9f0330319907524607ebb7a4b35e79c`

**Explorer:** https://sepolia.starkscan.co/contract/0x034fefb6137bc137491b2226a362d67a1485496e02e9b261b273f39d7b97aebd

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use (verifies ZK proofs for position opens/closes)

---

## LiquidationHandler Contract ✅ DEPLOYED

**Contract Name:** `LiquidationHandler`

**Deployed Address:** `0x0099200e8b478e108418620ba6bebc8ad0afd51d74f310c7969fe6517f2a9803`

**Class Hash:** `0x219321280bf81c4abc74b397fa82f25c7344bdb8a98a71b3baa5d2ddafad446`

**Declaration Transaction:** `0x59e31300d385ea929282921a3f4b2868428504e966e9868c833b067c831978`

**Deployment Transaction:** `0x04a8e57eaefd9cd13623c42604329666e72b0a88e7a346c402c3a982117e8996`

**Explorer:** https://sepolia.starkscan.co/contract/0x0099200e8b478e108418620ba6bebc8ad0afd51d74f310c7969fe6517f2a9803

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use (verifies ZK proofs for liquidations)

---

## OrderHandler Contract ✅ DEPLOYED

**Contract Name:** `OrderHandler`

**Deployed Address:** `0x06a3de8fe9c30b50189838625d904b9519597c0288de03b1bc652266c8b37836`

**Class Hash:** `0x30e79af3f971b89e2430bbbc91f1f389d561fba4dfa71900c5267f57a23dd65`

**Declaration Transaction:** `0x12f252ba9d199dcad21fbaf27d598770d646c15ac2acb465739c03e942dec0`

**Deployment Transaction:** `0x01841c87b9df31cee4c4af0366b823080d06fb71815a7d7dd01eb7d0e35a2ffd`

**Explorer:** https://sepolia.starkscan.co/contract/0x06a3de8fe9c30b50189838625d904b9519597c0288de03b1bc652266c8b37836

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use (handles market, limit, and TWAP orders)

---

## RiskManager Contract ✅ DEPLOYED

**Contract Name:** `RiskManager`

**Deployed Address:** `0x01265e715530e1b0cdc0cff1ef92130772bd02d48fc56c3937194b88e5d3ddb8`

**Class Hash:** `0x679bb9073616fa0d555af2ff8b91db616313a7ee32ce6674e8c16a153eb1ba2`

**Declaration Transaction:** `0x2fe692ce5e7894456ea48c6690a96e2f85fd55b6798faae7cb761ad023e7519`

**Deployment Transaction:** `0x0277859897d8f8a2c5e0c7dce4a69b6ae1374336a726f6a9292f6f74afa53740`

**Explorer:** https://sepolia.starkscan.co/contract/0x01265e715530e1b0cdc0cff1ef92130772bd02d48fc56c3937194b88e5d3ddb8

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use (manages risk parameters and position limits)

---

## PerpRouter Contract ✅ DEPLOYED

**Contract Name:** `PerpRouter`

**Deployed Address:** `0x06cdd1311b7bf1bba7032410c5e49d68201c74bae2d40ac15007cc68d381e35e`

**Class Hash:** `0x47cd3c28b8687dbe7ae5fd21ee2069590451841d40a5914501d3aeae92127b1`

**Declaration Transaction:** `0x49b779a0bb63369a20ff9b046c0e0f5da94370b96f85db704b8a6786a356a22`

**Deployment Transaction:** `0x013a3cc6756f3d7a55784e0f0df4511ca1a3f4e73fd3600e010c804d96f48890`

**Explorer:** https://sepolia.starkscan.co/contract/0x06cdd1311b7bf1bba7032410c5e49d68201c74bae2d40ac15007cc68d381e35e

**Network:** Ztarknet (Zypherpunk Testnet)

**Status:** ✅ Ready to use (main entry point for all trading operations)

---

## Perpetual Contracts Deployment Status

- [x] RoleStore
- [x] EventEmitter
- [x] DataStore
- [x] Oracle (uses mock feed)
- [x] CollateralVault
- [x] PositionHandler ✅ (verifier integrated)
- [x] OrderHandler ✅
- [x] LiquidationHandler ✅ (verifier integrated)
- [x] RiskManager ✅
- [x] PerpRouter ✅

---

## 🎉 All Contracts Deployed!

**Last Updated:** After PerpRouter deployment

**Main Entry Point:** `PerpRouter` at `0x06cdd1311b7bf1bba7032410c5e49d68201c74bae2d40ac15007cc68d381e35e`

