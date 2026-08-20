-- Oral Reading Fluency Assessment — schema + seed data

CREATE TABLE student (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_initial TEXT NOT NULL,
    grade INTEGER NOT NULL
);

CREATE TABLE passage (
    id SERIAL PRIMARY KEY,
    grade_level INTEGER NOT NULL,
    title TEXT NOT NULL,
    word_tokens TEXT[] NOT NULL,
    total_words INTEGER NOT NULL
);

CREATE TABLE benchmark_norm (
    grade INTEGER NOT NULL,
    season TEXT NOT NULL, -- 'fall' | 'winter' | 'spring'
    at_benchmark_wcpm INTEGER NOT NULL,
    some_risk_wcpm INTEGER NOT NULL,
    PRIMARY KEY (grade, season)
);

CREATE TABLE assessment (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES student(id),
    passage_id INTEGER NOT NULL REFERENCES passage(id),
    administered_at TIMESTAMP NOT NULL DEFAULT now(),
    season TEXT NOT NULL,
    words_read INTEGER NOT NULL,
    errors_json JSONB NOT NULL DEFAULT '[]',
    wcpm INTEGER NOT NULL,
    accuracy_pct NUMERIC(5,2) NOT NULL,
    risk_tier TEXT NOT NULL
);

-- Seed: one student, grade 3
INSERT INTO student (first_name, last_initial, grade) VALUES ('Maya', 'T', 3);

-- Seed: one grade-3 passage, ~120 words, pre-tokenized
INSERT INTO passage (grade_level, title, word_tokens, total_words) VALUES (
    3,
    'The Garden Surprise',
    ARRAY[
        'Every','morning','before','school','Leo','walked','past','the','old','community',
        'garden','on','the','corner','of','Maple','Street','The','garden','had','been',
        'empty','for','years','with','only','weeds','and','broken','fences','But','one',
        'Saturday','Leo','saw','something','strange','A','group','of','neighbors','was',
        'pulling','weeds','and','turning','soil','with','shiny','shovels','Leo','stopped',
        'his','bike','and','watched','An','older','woman','named','Mrs','Alvarez','waved',
        'him','over','and','asked','if','he','wanted','to','help','plant','tomatoes','Leo',
        'was','not','sure','at','first','but','he','put','down','his','bike','and','grabbed',
        'a','small','shovel','By','the','end','of','the','afternoon','his','hands','were',
        'covered','in','dirt','and','he','felt','proud','Weeks','later','Leo','rode','past',
        'the','same','corner','and','saw','bright','red','tomatoes','hanging','from','green',
        'vines','He','smiled','and','decided','to','stop','and','help','again'
    ],
    133
);

-- Seed: benchmark norms for grade 3, one season (spring)
INSERT INTO benchmark_norm (grade, season, at_benchmark_wcpm, some_risk_wcpm) VALUES
    (3, 'spring', 100, 75);

-- Seed: a few historical assessments so the progress chart has something to show
INSERT INTO assessment (student_id, passage_id, administered_at, season, words_read, errors_json, wcpm, accuracy_pct, risk_tier)
VALUES
    (1, 1, now() - interval '5 months', 'fall',   68, '[]', 60, 88.2, 'some_risk'),
    (1, 1, now() - interval '3 months', 'winter', 82, '[]', 76, 92.7, 'some_risk'),
    (1, 1, now() - interval '1 month',  'spring', 91, '[]', 85, 93.4, 'at_benchmark');
