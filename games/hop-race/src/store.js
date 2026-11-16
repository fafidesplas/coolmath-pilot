/*
    HOP RACE - cosmetics store (scaffolding). A catalog of items, a coin balance and owned items in the
    save, buy and equip, and coins from a rewarded ad. The hat art is in src/hats.js. Not built yet: a P2 pick.
    The catalog is 21 hats (GDD §7's 8, with a football helmet for the propeller, and 13 more) with placeholder prices.
    The moustache is a "hat" too: one item is worn at a time.
*/

'use strict';

const HR_STORE = [
    {id: 'cap',       kind: 'hat', name: 'Cap',          price: 50},
    {id: 'beanie',    kind: 'hat', name: 'Beanie',       price: 75},
    {id: 'party',     kind: 'hat', name: 'Party Hat',    price: 100},
    {id: 'chef',      kind: 'hat', name: 'Chef Hat',     price: 125},
    {id: 'football',  kind: 'hat', name: 'Football',     price: 150},
    {id: 'cowboy',    kind: 'hat', name: 'Cowboy Hat',   price: 175},
    {id: 'tophat',    kind: 'hat', name: 'Top Hat',      price: 200},
    {id: 'bowler',    kind: 'hat', name: 'Bowler Hat',   price: 200},
    {id: 'pilot',     kind: 'hat', name: 'Pilot Cap',    price: 225},
    {id: 'pirate',    kind: 'hat', name: 'Pirate Hat',   price: 250},
    {id: 'bunny',     kind: 'hat', name: 'Bunny Ears',   price: 250},
    {id: 'mustache',  kind: 'hat', name: 'Mustache',     price: 275},
    {id: 'racer',     kind: 'hat', name: 'Race Helmet', price: 300},
    {id: 'viking',    kind: 'hat', name: 'Viking Horns', price: 300},
    {id: 'ninja',     kind: 'hat', name: 'Ninja Mask',   price: 325},
    {id: 'jester',    kind: 'hat', name: 'Jester Hat',   price: 325},
    {id: 'wizard',    kind: 'hat', name: 'Wizard Hat',   price: 350},
    {id: 'spartan',   kind: 'hat', name: 'Spartan',     price: 375},
    {id: 'crown',     kind: 'hat', name: 'Crown',        price: 400},
    {id: 'salakot',   kind: 'hat', name: 'Salakot',      price: 450},
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
