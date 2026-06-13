const mongoose = require("mongoose");

const newsMediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["video", "image"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: "",
    },
    mimeType: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const newsCommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isHidden: {
      type: Boolean,
      default: false,
    },
    replies: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 1000,
        },
        likeCount: {
          type: Number,
          default: 0,
        },
        likedBy: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        isHidden: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const newsPostSchema = new mongoose.Schema(
  {
    header: {
      type: String,
      required: [true, "News header is required"],
      trim: true,
      maxlength: 220,
    },
    subHeader: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    body: {
      type: String,
      required: [true, "News body is required"],
      trim: true,
      maxlength: 20000,
    },
    section: {
      type: String,
      enum: ["news", "career", "unspoken"],
      default: "news",
      index: true,
    },
    categories: {
      type: [String],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length >= 1 && items.length <= 5,
        message: "A news post must have 1 to 5 categories",
      },
    },
    mediaFiles: {
      type: [newsMediaSchema],
      default: [],
    },
    adsEnabled: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    source: {
      type: String,
      trim: true,
      default: "NendPlay News",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    comments: {
      type: [newsCommentSchema],
      default: [],
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

newsPostSchema.index({ status: 1, createdAt: -1 });
newsPostSchema.index({ section: 1, status: 1, createdAt: -1 });
newsPostSchema.index({ categories: 1, createdAt: -1 });
newsPostSchema.index({ header: "text", subHeader: "text", body: "text" });

module.exports = mongoose.model("NewsPost", newsPostSchema);
