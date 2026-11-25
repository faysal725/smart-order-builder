import type { Menu } from "../engine/types";

// All money in poisha (BDT x 100). 20 BDT = 2000.
// Ingredient missing from `stock` = unlimited (ketchup, chili).
export const menu: Menu = {
  basePrice: 25000, // 250 BDT

  groups: [
    {
      id: "bread",
      name: "Bread",
      min: 1,
      max: 1,
      options: [
        { id: "toast", name: "Toast", price: 0, ingredients: { toast: 1 } }, // VERIFY
        { id: "paratha", name: "Paratha", price: 2000, ingredients: { paratha: 1 } }, // VERIFY
        { id: "croissant", name: "Croissant", price: 6000, ingredients: { croissant: 1 } }, // VERIFY
      ],
    },
    {
      id: "eggs",
      name: "Eggs",
      min: 0,
      max: 4, // VERIFY (seed orders use 4 egg units)
      maxDistinct: 2, // VERIFY
      maxPerOption: 2, // VERIFY
      options: [
        { id: "fried", name: "Fried Egg", price: 3000, ingredients: { egg: 1 } }, // VERIFY
        { id: "scrambled", name: "Scrambled Egg", price: 3500, ingredients: { egg: 2 } }, // VERIFY
        { id: "omelette", name: "Omelette", price: 7000, ingredients: { egg: 2 } }, // VERIFY
      ],
    },
    {
      id: "protein",
      name: "Protein",
      min: 1,
      max: 3,
      options: [
        { id: "sausage", name: "Chicken Sausage", price: 5000, ingredients: { sausage: 1 } }, // VERIFY
        { id: "bacon", name: "Beef Bacon", price: 9000, ingredients: { bacon: 1 } }, // VERIFY
        { id: "tofu", name: "Tofu", price: 5000, ingredients: { tofu: 1 } }, // VERIFY
      ],
    },
    {
      id: "extras",
      name: "Extras",
      min: 0,
      max: 4,
      options: [
        { id: "hashbrown", name: "Hash Brown", price: 4000, ingredients: { hashbrown: 1 } }, // VERIFY
        { id: "mushroom", name: "Mushroom", price: 3000, ingredients: { mushroom: 1 } }, // VERIFY
        { id: "beans", name: "Baked Beans", price: 2500, ingredients: { beans: 1 } }, // VERIFY
        { id: "cheese", name: "Cheese", price: 3500, ingredients: { cheese: 1 } }, // VERIFY
      ],
    },
    {
      id: "sauce",
      name: "Sauce",
      min: 0,
      max: 2,
      maxDistinct: 2,
      maxPerOption: 1,
      options: [
        { id: "ketchup", name: "Ketchup", price: 0, ingredients: {} }, // VERIFY
        { id: "hollandaise", name: "Hollandaise", price: 1500, ingredients: { hollandaise: 1 } }, // VERIFY
        { id: "chili", name: "Chili", price: 1000, ingredients: {} }, // VERIFY
      ],
    },
  ],

  rules: [
    // R1: hollandaise needs scrambled or omelette
    { type: "requires", id: "R1", option: "hollandaise", anyOf: ["scrambled", "omelette"] },
    // R2: tofu excludes sausage and bacon
    { type: "excludes", id: "R2", option: "tofu", excluded: ["sausage", "bacon"] },
    // R3: croissant drops extras max to 2
    { type: "overrideLimit", id: "R3", ifOption: "croissant", group: "extras", max: 2 },
    // R4: chili excludes hollandaise
    { type: "excludes", id: "R4", option: "chili", excluded: ["hollandaise"] },
  ],

  stock: {
    toast: 20, // VERIFY
    paratha: 10,
    croissant: 2,
    egg: 10,
    sausage: 4,
    bacon: 3,
    tofu: 5,
    hashbrown: 6,
    mushroom: 6,
    beans: 8,
    cheese: 4,
    hollandaise: 5,
  },
};