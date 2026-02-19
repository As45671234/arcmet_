const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: "" },
    name: { type: String, required: true },
    sku: { type: String, default: "" },
    unit: { type: String, default: "шт" },
    image: { type: String, default: "" },
    price: { type: Number },
    quantity: { type: Number, required: true },
    lineTotal: { type: Number }
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    // Name is optional, but phone + email are required so we can always contact the client.
    customerName: { type: String, default: "" },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String, required: true },
    address: { type: String, default: "" },
    comment: { type: String, default: "" },

    status: { type: String, enum: ["new", "processing", "completed", "cancelled"], default: "new", index: true },

    items: { type: [OrderItemSchema], default: [] },

    total: { type: Number, default: 0 }
  },
  { timestamps: true }
);

OrderSchema.index({ createdAt: -1 });

OrderSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Order", OrderSchema);
