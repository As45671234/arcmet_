
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },

    category_id: { type: String, required: true, index: true },
    category_title: { type: String, required: true },

    name: { type: String, required: true },
    brandOrGroup: { type: String, default: "" },

    unit: { type: String, default: "шт" },
    sku: { type: String, default: "" },
    image: { type: String, default: "" },
    description: { type: String, default: "" },

    prices: {
      retail: { type: Number },
      purchase: { type: Number },
      recommended: { type: Number },
      wholesale_5m: { type: Number },
      wholesale_1m: { type: Number },
      client: { type: Number },
      online: { type: Number },
      ozon: { type: Number },
      note: { type: String }
    },

    attrs: { type: mongoose.Schema.Types.Mixed, default: {} },

    inStock: { type: Boolean, default: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ProductSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Product", ProductSchema);
