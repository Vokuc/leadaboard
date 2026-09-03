import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MARKETPLACE_TEMPLATES, getMarketplaceTemplate } from '@/lib/templates/marketplace';
import TemplatePageWrapper from '@/components/templates/TemplatePageWrapper';
import { BASE_URL } from '@/lib/seo/metadata';

interface Props {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  return MARKETPLACE_TEMPLATES.map((template) => ({
    slug: template.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const template = getMarketplaceTemplate(params.slug);
  
  if (!template) {
    return {
      title: 'Template Not Found | LeaderboardOS',
    };
  }

  const url = `${BASE_URL}/templates/${template.slug}`;

  return {
    title: template.title,
    description: template.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: template.title,
      description: template.description,
      url,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: template.title,
      description: template.description,
    }
  };
}

export default function TemplatePage({ params }: Props) {
  const template = getMarketplaceTemplate(params.slug);

  if (!template) {
    notFound();
  }

  return (
    <TemplatePageWrapper template={template}>
      <section className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 md:p-10 flex flex-col md:flex-row gap-8 items-center text-center md:text-left">
        <div className="flex-1 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">How it works</h2>
          <p className="text-neutral-400 leading-relaxed">
            This template is built on our <strong>{template.creationConfig.engine.replace('_', ' ')}</strong> engine, 
            optimized for <strong>{template.category}</strong> use cases. It supports automatic sorting, 
            tie-breakers, and real-time updates straight out of the box.
          </p>
        </div>
      </section>
    </TemplatePageWrapper>
  );
}
