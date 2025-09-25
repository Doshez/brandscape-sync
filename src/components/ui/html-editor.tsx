import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Eye, Code, Type, Image, Bold, Italic, Link, AlignLeft, AlignCenter, AlignRight, ImageIcon } from "lucide-react";

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  height?: string;
}

export const HtmlEditor: React.FC<HtmlEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter your content...",
  label = "Content",
  height = "300px"
}) => {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select a valid image file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `email-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('email-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('email-assets')
        .getPublicUrl(filePath);

      // Insert image HTML at cursor position or append
      const imageHtml = `<img src="${publicUrl}" alt="Uploaded image" style="max-width: 100%; height: auto;" />`;
      onChange(value + '\n' + imageHtml);

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const insertHtmlTag = (tag: string, hasClosing = true) => {
    const openTag = `<${tag}>`;
    const closeTag = hasClosing ? `</${tag}>` : '';
    const newContent = value + openTag + closeTag;
    onChange(newContent);
  };

  const insertFormatting = (format: string) => {
    switch (format) {
      case 'bold':
        insertHtmlTag('strong');
        break;
      case 'italic':
        insertHtmlTag('em');
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          const linkHtml = `<a href="${url}">Link text</a>`;
          onChange(value + linkHtml);
        }
        break;
      case 'br':
        insertHtmlTag('br', false);
        break;
      case 'p':
        insertHtmlTag('p');
        break;
      case 'h1':
        insertHtmlTag('h1');
        break;
      case 'h2':
        insertHtmlTag('h2');
        break;
      case 'h3':
        insertHtmlTag('h3');
        break;
    }
  };

  const insertAlignment = (align: string) => {
    const alignHtml = `<div style="text-align: ${align};">Content here</div>`;
    onChange(value + '\n' + alignHtml);
  };

  const insertCenteredImage = () => {
    const imageUrl = prompt('Enter image URL (or upload an image using the Image button):');
    if (imageUrl) {
      const centeredImageHtml = `<div style="text-align: center; margin: 10px 0;"><img src="${imageUrl}" alt="Centered image" style="max-width: 100%; height: auto; display: inline-block;" /></div>`;
      onChange(value + '\n' + centeredImageHtml);
    }
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="html-editor">{label}</Label>
      
      <Tabs value={mode} onValueChange={(value) => setMode(value as "visual" | "html")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Visual Editor
          </TabsTrigger>
          <TabsTrigger value="html" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            HTML Code
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="visual" className="space-y-4">
          {/* Toolbar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1 border-r pr-2 mr-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('bold')}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('italic')}
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('link')}
                    title="Insert Link"
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex gap-1 border-r pr-2 mr-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertAlignment('left')}
                    title="Align Left"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertAlignment('center')}
                    title="Align Center"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertAlignment('right')}
                    title="Align Right"
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-1 border-r pr-2 mr-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('h1')}
                    title="Heading 1"
                  >
                    H1
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('h2')}
                    title="Heading 2"
                  >
                    H2
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('h3')}
                    title="Heading 3"
                  >
                    H3
                  </Button>
                </div>

                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('p')}
                    title="Paragraph"
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting('br')}
                    title="Line Break"
                  >
                    BR
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Upload Image"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : (
                      <Image className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={insertCenteredImage}
                    title="Insert Centered Image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Editor</Label>
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ height }}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <Card style={{ height }}>
                <CardContent className="p-4 overflow-auto h-full">
                  <div 
                    dangerouslySetInnerHTML={{ __html: value || '<p class="text-muted-foreground">Preview will appear here...</p>' }}
                    className="prose prose-sm max-w-none"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="html">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ height }}
            className="font-mono text-sm"
          />
        </TabsContent>
      </Tabs>

      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file);
          }
        }}
        className="hidden"
      />
    </div>
  );
};