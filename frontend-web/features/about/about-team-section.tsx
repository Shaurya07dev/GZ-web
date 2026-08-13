"use client";

import "@/lib/motion-config";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Demo/placeholder roster -- GalleryZone has no public team page or roster
// today, so these are illustrative names, not real people. Initials-only
// avatars (no generated headshots) keep that honest at a glance.
interface TeamMember {
  name: string;
  initials: string;
  role: string;
}

const TEAM: TeamMember[] = [
  { name: "Devika Menon", initials: "DM", role: "Founder & CEO" },
  {
    name: "Arav Shah",
    initials: "AS",
    role: "Co-founder & Head of Engineering",
  },
  {
    name: "Naledi Correia",
    initials: "NC",
    role: "Head of Curation & Verification",
  },
  { name: "Kabir Oberoi", initials: "KO", role: "Head of Artist Success" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function AboutTeamSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              Team
            </span>
            <h2 className="mt-4 text-balance font-display text-3xl leading-[1.15] font-semibold sm:text-4xl">
              The people behind it.
            </h2>
            <p className="mt-3 max-w-md text-balance text-base leading-relaxed text-muted-foreground">
              A small crew building the trust layer between artists, galleries,
              and collectors.
            </p>
          </div>

          <Link
            href="/contact"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <span
              className="size-1.5 rounded-full bg-emerald-500"
              aria-hidden
            />
            We&rsquo;re hiring
            <ArrowUpRight className="size-3.5" />
          </Link>
        </motion.div>

        <motion.div
          className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {TEAM.map((member) => (
            <motion.div
              key={member.name}
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <Avatar size="lg" className="border-none ring-0">
                <AvatarFallback className="bg-gold/10 text-sm font-semibold text-gold-bright">
                  {member.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{member.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {member.role}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
