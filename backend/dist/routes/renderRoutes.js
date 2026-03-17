import { z } from "zod";
import { renderLabel } from "../services/labelaryClient.js";
const renderPreviewBodySchema = z.object({
    zpl: z.string().min(1),
    dpmm: z.number().int().min(6).max(24).default(8),
    widthIn: z.number().positive().default(4),
    heightIn: z.number().positive().default(6),
    index: z.number().int().min(0).default(0),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
    darkness: z.number().min(0).max(30).optional(),
});
export const renderRoutes = async (app) => {
    app.post("/api/render/preview", async (req, reply) => {
        const body = renderPreviewBodySchema.parse(req.body);
        const png = await renderLabel({
            format: "png",
            zpl: body.zpl,
            dpmm: body.dpmm,
            widthIn: body.widthIn,
            heightIn: body.heightIn,
            index: body.index,
            rotation: body.rotation,
            darkness: body.darkness,
        });
        reply.header("Content-Type", "image/png");
        return reply.send(png);
    });
};
