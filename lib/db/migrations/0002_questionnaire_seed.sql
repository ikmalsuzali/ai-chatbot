-- Create the QuestionnaireQuestion table first
CREATE TABLE IF NOT EXISTS "QuestionnaireQuestion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "question" text NOT NULL,
  "key" varchar(64) NOT NULL UNIQUE,
  "placeholder" text,
  "order" integer NOT NULL,
  "is_required" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

DO $$ 
BEGIN

-- Section 1: Passions
INSERT INTO "QuestionnaireQuestion" ("question", "key", "placeholder", "order", "is_required")
VALUES 
  ('What topics or causes make you feel excited and energized?', 'passions_topics', 'Share the subjects that spark your enthusiasm...', 1, true),
  ('If you had to teach or talk about one thing for the rest of your life, what would it be?', 'passions_teach_topic', 'Describe your most passionate teaching subject...', 2, true),
  ('What kinds of challenges or problems in the world do you feel most compelled to solve?', 'passions_challenges', 'Outline the problems you want to address...', 3, true),
  ('What types of conversations do you naturally gravitate toward in social or professional settings?', 'passions_conversations', 'Describe your preferred discussion topics...', 4, true),
  ('What personal achievements or moments bring you the most pride and fulfillment?', 'passions_achievements', 'Share your most meaningful accomplishments...', 5, true);

-- Section 2: Strengths
INSERT INTO "QuestionnaireQuestion" ("question", "key", "placeholder", "order", "is_required")
VALUES 
  ('What skills or talents have you consistently excelled at throughout your life?', 'strengths_consistent', 'List your enduring talents...', 6, true),
  ('What specific skills, strategies, or knowledge have helped you succeed in your career?', 'strengths_career', 'Describe your key professional capabilities...', 7, true),
  ('In what areas do people most often come to you for advice or guidance?', 'strengths_advice', 'Share your areas of expertise...', 8, true),
  ('Have you ever created a method, solution, or system that others have benefited from?', 'strengths_solutions', 'Describe your innovative contributions...', 9, true),
  ('What is a recurring compliment or piece of feedback you often hear from others?', 'strengths_feedback', 'Share common praise you receive...', 10, true);

-- Section 3: Experiences
INSERT INTO "QuestionnaireQuestion" ("question", "key", "placeholder", "order", "is_required")
VALUES 
  ('What unique or life-changing experiences have shaped who you are today?', 'experiences_life_changing', 'Share your transformative moments...', 11, true),
  ('Have you overcome any major challenges or setbacks that others would find inspiring?', 'experiences_challenges', 'Describe significant obstacles you''ve overcome...', 12, true),
  ('Do you have a story or moment in your life that people find captivating or motivational?', 'experiences_story', 'Share your most compelling story...', 13, true),
  ('Have you worked in or been exposed to industries undergoing significant change or innovation?', 'experiences_industry', 'Describe your experience with industry transformation...', 14, true),
  ('What accomplishments, personal or professional, make you feel credible to speak on certain topics?', 'experiences_credibility', 'List achievements that establish your authority...', 15, true);

-- Section 4: Expertise
INSERT INTO "QuestionnaireQuestion" ("question", "key", "placeholder", "order", "is_required")
VALUES 
  ('What is your professional or academic background, and how does it contribute to your expertise?', 'expertise_background', 'Detail your relevant qualifications...', 16, true),
  ('Do you have any certifications, awards, recognitions or brand affiliations that add to your credibility?', 'expertise_credentials', 'List your professional credentials...', 17, true),
  ('Have you written articles, conducted research, or contributed thought leadership in your field?', 'expertise_contributions', 'Share your intellectual contributions...', 18, true),
  ('Have you successfully mentored, coached, or trained others in any capacity?', 'expertise_mentoring', 'Describe your experience in developing others...', 19, true),
  ('Do you have a strong personal brand, social media following, or network in a specific domain?', 'expertise_presence', 'Detail your professional presence and reach...', 20, true);

-- Section 5: Vision
INSERT INTO "QuestionnaireQuestion" ("question", "key", "placeholder", "order", "is_required")
VALUES 
  ('What kind of impact do you want to make as a speaker?', 'vision_impact', 'Describe your desired influence...', 21, true),
  ('Who are the audiences you most want to educate, inspire, or influence (e.g., corporate teams, entrepreneurs, youth)?', 'vision_audience', 'Identify your target audiences...', 22, true),
  ('What is the one message or idea you want people to remember after hearing you speak?', 'vision_message', 'Share your core message...', 23, true),
  ('What types of speaking engagements excite you the most (e.g., conferences, motivational talks, expert panels)?', 'vision_engagements', 'List your preferred speaking formats...', 24, true),
  ('Where do you see yourself as a speaker in the next 3–5 years?', 'vision_future', 'Describe your speaking career goals...', 25, true);

-- Section 6: Possibilities
INSERT INTO "QuestionnaireQuestion" ("question", "key", "placeholder", "order", "is_required")
VALUES 
  ('Are there any topics you''ve always been curious about but haven''t pursued yet?', 'possibilities_curiosity', 'Share your unexplored interests...', 26, true),
  ('If you had unlimited time and resources, what new skill, knowledge, or expertise would you want to develop?', 'possibilities_development', 'Describe your aspirational learning goals...', 27, true),
  ('What emerging trends or topics in your industry or field excite you the most?', 'possibilities_trends', 'Identify exciting industry developments...', 28, true),
  ('Are there industries or audiences you''ve never worked with but would love to impact through speaking?', 'possibilities_new_audiences', 'List potential new speaking territories...', 29, true),
  ('What challenges or opportunities do you see in the world today that you feel inspired to address?', 'possibilities_opportunities', 'Share the global issues you want to tackle...', 30, true);

END $$; 