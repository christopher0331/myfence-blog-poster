"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Loader2, ImagePlus, CheckCircle } from "lucide-react";

export default function SubmitFeedbackPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/feedback/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.url) {
        setImages((prev) => [...prev, data.url]);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          message: message.trim(),
          image_urls: images,
          author: "client",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setSubject("");
        setMessage("");
        setImages([]);
      } else {
        alert(data.error || "Failed to submit");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 pb-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Request sent</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Your feedback has been submitted. We&apos;ll review it and get back to you.
            </p>
            <Button variant="outline" onClick={() => setSent(false)}>
              Submit another request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Request changes or share ideas</CardTitle>
          <p className="text-muted-foreground text-sm">
            Describe what you&apos;d like to change or suggest. You can attach screenshots or images.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subject" className="text-sm font-medium mb-1 block">
                Subject (optional)
              </label>
              <Input
                id="subject"
                placeholder="e.g. Update hero section copy"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="message" className="text-sm font-medium mb-1 block">
                Message *
              </label>
              <Textarea
                id="message"
                placeholder="Describe the changes you'd like..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                required
                className="w-full resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Images (optional)</label>
              <div className="flex flex-wrap items-center gap-2">
                {images.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-auto rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    Add image
                  </span>
                </label>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!message.trim() || submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send request
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
