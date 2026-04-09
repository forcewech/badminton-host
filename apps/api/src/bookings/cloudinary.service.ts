import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";

type UploadFileShape = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.configService.get<string>("CLOUDINARY_API_KEY"),
      api_secret: this.configService.get<string>("CLOUDINARY_API_SECRET"),
    });
  }

  async uploadCustomerPhoto(file: UploadFileShape) {
    if (!file?.buffer) {
      throw new BadRequestException("Customer photo file is required.");
    }

    if (!file.mimetype?.startsWith("image/")) {
      throw new BadRequestException("Only image uploads are supported.");
    }

    if (!this.hasCloudinaryConfig()) {
      throw new InternalServerErrorException(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      );
    }

    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "badminton-customers",
          resource_type: "image",
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                error?.message ?? "Customer photo upload failed.",
              ),
            );
            return;
          }

          resolve({
            url: cloudinary.url(result.public_id, {
              secure: true,
              transformation: [
                {
                  fetch_format: "auto",
                  quality: "auto",
                },
              ],
            }),
            publicId: result.public_id,
          });
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteCustomerPhoto(publicId: string) {
    if (!publicId || !this.hasCloudinaryConfig()) {
      return;
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  }

  private hasCloudinaryConfig() {
    return Boolean(
      this.configService.get<string>("CLOUDINARY_CLOUD_NAME") &&
      this.configService.get<string>("CLOUDINARY_API_KEY") &&
      this.configService.get<string>("CLOUDINARY_API_SECRET"),
    );
  }
}
