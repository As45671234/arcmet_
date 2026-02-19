const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    // Name is optional (client may not want to provide it)
    name: { type: String, default: "" },
    // Phone + email are required so we can contact the client even if the phone is unavailable
    phone: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, default: "" },

    status: { type: String, enum: ["new", "processing", "done"], default: "new", index: true }
  },
  { timestamps: true }
);

LeadSchema.index({ createdAt: -1 });

LeadSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Lead", LeadSchema);
