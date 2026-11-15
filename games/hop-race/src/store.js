/*
    HOP RACE - cosmetics store (scaffolding). A catalog of items, a coin balance and owned items in the
    save, buy and equip, and coins from a rewarded ad. Not built yet: drawing hats on the players, a P2 pick.
    The catalog is GDD §7's 8 hats with placeholder prices.
*/

'use strict';

const HR_STORE = [
    {id: 'cap',       kind: 'hat', name: 'Cap',          price: 50},
    {id: 'beanie',    kind: 'hat', name: 'Beanie',       price: 75},
    {id: 'party',     kind: 'hat', name: 'Party Hat',    price: 100},
    {id: 'propeller', kind: 'hat', name: 'Propeller',    price: 150},
    {id: 'tophat',    kind: 'hat', name: 'Top Hat',      price: 200},
    {id: 'viking',    kind: 'hat', name: 'Viking Horns', price: 300},
    {id: 'crown',     kind: 'hat', name: 'Crown',        price: 400},
    {id: 'halo',      kind: 'hat', name: 'Halo',         price: 500},
];

const HR_STORE_AD_COINS = 50;   // coins for watching a rewarded ad
let hrStoreGotT = -9;            // timeReal of the last ad reward, for the "+50" pop

// "Watch an ad" in the store: Coolmath's rewarded ad (src/cmg.js), then the coins
function hrStoreWatchAd()
{
    hrCmgRewardAd(() =>
    {
        hrStoreAddCoins(HR_STORE_AD_COINS);
        hrStoreGotT = timeReal;
        hrSfx.star.play();
        hrGaDesign('store:ad:reward', HR_STORE_AD_COINS);
    });
}

function hrStoreItem(id) { return HR_STORE.find(it => it.id == id); }
function hrStoreOwned(id) { return hrSave.owned.includes(id); }
function hrStoreEquipped(id, player = 'p1') { return hrSave.hats[player] == id; }
function hrStoreCanBuy(id) { const it = hrStoreItem(id); return !!it && !hrStoreOwned(id) && hrSave.coins >= it.price; }

function hrStoreAddCoins(n)
{
    hrSave.coins = max(0, hrSave.coins + n);
    hrSaveWrite();
}

function hrStoreBuy(id)
{
    if (!hrStoreCanBuy(id)) return false;
    hrSave.coins -= hrStoreItem(id).price;
    hrSave.owned.push(id);
    hrSaveWrite();
    hrGaDesign('store:buy:' + id, hrStoreItem(id).price);
    return true;
}

// put an owned item on a player, or take it off if they already wear it
function hrStoreEquip(id, player = 'p1')
{
    if (!hrStoreOwned(id)) return;
    hrSave.hats[player] = hrSave.hats[player] == id ? null : id;
    hrSaveWrite();
}

// a store tile was pressed: equip what you own, buy what you can afford
function hrStorePick(id)
{
    if (hrStoreOwned(id)) hrStoreEquip(id);
    else if (hrStoreBuy(id)) hrStoreEquip(id);
}
