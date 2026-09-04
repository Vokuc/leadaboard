import React from 'react';
import { SeoPageContent } from '@/lib/seo/content';
import { CheckCircle2 } from 'lucide-react';

interface SeoFeaturesProps {
  content: SeoPageContent;
}

export default function SeoFeatures({ content }: SeoFeaturesProps) {
  if (!content.features || content.features.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Features that power your {content.h1.toLowerCase()}
          </h2>
          <p className="text-neutral-400 text-lg">
            Everything you need to run your event, right out of the box.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {content.features.map((feature, idx) => (
            <div key={idx} className="glass p-8 rounded-3xl border-white/5 hover:border-violet-500/30 transition-colors group">
              <div className="w-12 h-12 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6 border border-violet-500/20 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-neutral-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
