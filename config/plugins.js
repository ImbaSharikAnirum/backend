module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "aws-s3",
      providerOptions: {
        accessKeyId: env("AWS_ACCESS_KEY_ID"),
        secretAccessKey: env("AWS_SECRET_KEY"),
        region: env("AWS_REGION"),
        params: {
          Bucket: env("AWS_BUCKET"),
        },
      },

      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },

      sharpOptions: {
        webp: {
          alphaQuality: 90,
        },
      },
    },
  },

});