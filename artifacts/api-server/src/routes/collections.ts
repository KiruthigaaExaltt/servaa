import { Router } from "express";
import { CollectionRevision, mongoose } from "@workspace/db";
import { readResource, resourceNames, writeResource } from "../services/collectionResources";

const router = Router();
router.get("/collections/:resource", async (req, res, next): Promise<void> => {
  try {
    if (!resourceNames.has(req.params.resource)) { res.status(404).json({ error: { code: "RESOURCE_NOT_FOUND", message: "Unknown collection resource" } }); return; }
    const revision = await CollectionRevision.findOne({ outletId: req.outletId, resource: req.params.resource }).lean() as any;
    if (!revision) { res.status(404).json({ error: { code: "RESOURCE_NOT_INITIALIZED", message: "Resource has not been initialized" } }); return; }
    const value = await readResource(String(req.outletId), req.params.resource);
    res.json({ value, revision: revision?.revision ?? 0 });
  } catch (error) { next(error); }
});

router.put("/collections/:resource", async (req, res, next): Promise<void> => {
  try {
    const resource = req.params.resource;
    if (!resourceNames.has(resource) || !("value" in (req.body ?? {}))) { res.status(400).json({ error: { code: "INVALID_RESOURCE", message: "A known resource and value are required" } }); return; }
    const expected = Number(req.header("if-match"));
    let nextRevision = 0;
    await mongoose.connection.transaction(async () => {
      const current = await CollectionRevision.findOne({ outletId: req.outletId, resource }).lean() as any;
      const currentRevision = current?.revision ?? 0;
      if (Number.isFinite(expected) && expected !== currentRevision) {
        const conflict = new Error("REVISION_CONFLICT") as Error & { currentRevision?: number };
        conflict.currentRevision = currentRevision;
        throw conflict;
      }
      await writeResource(String(req.outletId), resource, req.body.value);
      const revision = await CollectionRevision.findOneAndUpdate(
        { outletId: req.outletId, resource },
        { $inc: { revision: 1 }, $setOnInsert: { outletId: req.outletId, resource } },
        { upsert: true, new: true },
      );
      nextRevision = revision.revision;
    });
    res.json({ value: req.body.value, revision: nextRevision });
  } catch (error) {
    if (error instanceof Error && error.message === "REVISION_CONFLICT") { res.status(409).json({ error: { code: "REVISION_CONFLICT", message: "Resource changed on another terminal", currentRevision: (error as Error & { currentRevision?: number }).currentRevision } }); return; }
    next(error);
  }
});
export default router;
