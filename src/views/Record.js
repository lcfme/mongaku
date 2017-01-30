// @flow

const React = require("react");

const metadata = require("../lib/metadata");
const options = require("../lib/options");

const Page = require("./Page.js");

import type {Context} from "./types.js";
const {childContextTypes} = require("./Wrapper.js");

type ImageType = {
    _id: string,
    getOriginalURL: () => string,
    getScaledURL: () => string,
    getThumbURL: () => string,
};

type UnpopulatedRecordType = {
    _id: string,
    type: string,
    url: string,
    images: Array<string>,
    getOriginalURL: () => string,
    getThumbURL: () => string,
    getTitle: () => string,
    getSource: () => Source,
    getURL: (lang: string) => string,
};

type RecordType = {
    _id: string,
    type: string,
    url: string,
    images: Array<ImageType>,
    getOriginalURL: () => string,
    getThumbURL: () => string,
    getTitle: () => string,
    getSource: () => Source,
    getURL: (lang: string) => string,
};

type Source = {
    _id: string,
    name: string,
    getURL: (lang: string) => string,
};

type Match = {
    _id: string,
    recordModel: UnpopulatedRecordType,
    score: number,
};

type Props = {
    compare: boolean,
    records: Array<RecordType>,
    similar: Array<Match>,
    sources: Array<Source>,
};

// Determine if at least one record has a value for this type
const hasValue = (records, type) => {
    return records.some((record) => {
        const value = record[type];
        return value && (!Array.isArray(value) || value.length > 0);
    });
};

const Title = (props: Props & {record: RecordType}) => {
    const {record, records} = props;
    const size = Math.max(Math.round(12 / records.length), 3);
    const title = options.types[record.type]
        .recordTitle(record, props);

    return <th className={`col-xs-${size} text-center`}>
        <h1 className="panel-title">{title}</h1>
    </th>;
};

const Image = ({
    image,
    record,
    active,
}: Props & {
    record: RecordType,
    image: ImageType,
    active: boolean,
}, {getTitle}: Context) => <div className={`item ${active ? "active" : ""}`}>
    <a href={image.getOriginalURL()}>
        <img src={image.getScaledURL()}
            alt={getTitle(record)}
            title={getTitle(record)}
            className="img-responsive center-block"
        />
    </a>
</div>;

Image.contextTypes = childContextTypes;

const Carousel = ({record}: Props & {record: RecordType}, {
    gettext,
}: Context) => {
    const carouselId = record._id.replace("/", "-");
    return <div>
        <ol className="carousel-indicators">
            {record.images.map((image, i) =>
                <li
                    data-target={`#${carouselId}`}
                    data-slide-to={i}
                    className={i === 0 ? "active" : ""}
                    key={`img${i}`}
                />
            )}
        </ol>
        <a className="left carousel-control"
            href={`#${carouselId}`} role="button"
            data-slide="prev"
        >
            <span className="glyphicon glyphicon-chevron-left"
                aria-hidden="true"
            />
            <span className="sr-only">
                {gettext("Previous")}
            </span>
        </a>
        <a className="right carousel-control"
            href={`#${carouselId}`} role="button"
            data-slide="next"
        >
            <span className="glyphicon glyphicon-chevron-right"
                aria-hidden="true"
            />
            <span className="sr-only">
                {gettext("Next")}
            </span>
        </a>
    </div>;
};

Carousel.contextTypes = childContextTypes;

const Images = (props: Props & {record: RecordType}) => {
    const {record} = props;
    const carouselId = record._id.replace("/", "-");

    return <td>
        <div id={carouselId} className="carousel" data-interval="0">
            <div className="carousel-inner" role="listbox">
                {record.images.map((image, i) => <Image
                    {...props}
                    record={record}
                    image={image}
                    active={i === 0}
                    key={i}
                />)}
            </div>

            {record.images.length > 1 &&
                <Carousel {...props} record={record} />}
        </div>
    </td>;
};

const Metadata = (props: Props) => {
    const {records, sources} = props;
    const firstRecord = records[0];

    if (!firstRecord) {
        return null;
    }

    // We assume that all the records are the same type
    const type = records[0].type;
    const model = metadata.model(type);

    return <tbody>
        {options.types[type].display.map((type) => {
            const typeSchema = model[type];

            // Hide if it there isn't at least one value to display
            if (!hasValue(records, type)) {
                return null;
            }

            return <tr key={type}>
                <th className="text-right">
                    {typeSchema.options.title(props)}
                </th>
                {records.map((record) => <td key={record._id}>
                    {typeSchema.renderView(record[type], props)}
                </td>)}
            </tr>;
        })}
        {hasValue(records, "url") && <Details {...props} />}
        {sources.length > 1 &&
            <Sources {...props} />}
    </tbody>;
};

const Details = ({records}: Props, {gettext}: Context) => <tr>
    <th className="text-right">
        {gettext("Details")}
    </th>
    {records.map((record) => {
        const link = <a href={record.url}>
            {gettext("More information...")}
        </a>;

        return <td key={record._id}>{link}</td>;
    })}
</tr>;

Details.contextTypes = childContextTypes;

const Sources = ({records}: Props, {
    gettext,
    URL,
    fullName,
}: Context) => <tr>
    <th className="text-right">
        {gettext("Source")}
    </th>
    {records.map((record) => {
        const source = record.getSource();

        return <td key={record._id}>
            <a href={URL(source)}>
                {fullName(source)}
            </a>
        </td>;
    })}
</tr>;

Sources.contextTypes = childContextTypes;

const MainRecord = (props: Props, {
    URL,
    gettext,
}: Context) => {
    const {similar, compare, records} = props;
    const recordWidth = similar.length > 0 ?
        "col-md-9" : "col-md-12";

    return <div className={`${recordWidth} imageholder`}>
        {(compare || records.length > 1) &&
            <a href={URL(records[0])}
                className="btn btn-success"
            >
                &laquo; {gettext("End Comparison")}
            </a>}
        <div className="responsive-table">
            <table className="table table-hover">
                <thead>
                    <tr className="plain">
                        <th/>
                        {records.map((record) => <Title
                            {...props} record={record} key={record._id}
                        />)}
                    </tr>
                    <tr className="plain">
                        <td/>
                        {records.map((record) => <Images
                            {...props} record={record} key={record._id}
                        />)}
                    </tr>
                </thead>
                <Metadata {...props} />
            </table>
        </div>
    </div>;
};

MainRecord.contextTypes = childContextTypes;

const SimilarMatch = ({
    match: {recordModel, score},
}: Props & {match: Match}, {
    URL,
    getTitle,
    format,
    gettext,
    fullName,
    shortName,
}: Context) => <div className="img col-md-12 col-xs-6 col-sm-4">
    <a href={URL(recordModel)}>
        <img src={recordModel.getThumbURL()}
            alt={getTitle(recordModel)}
            title={getTitle(recordModel)}
            className="img-responsive center-block"
        />
    </a>
    <div className="details">
        <div className="wrap">
            <span>{format(gettext(
                "Score: %(score)s"), {score: score})}</span>

            <a className="pull-right"
                href={URL(recordModel.getSource())}
                title={fullName(recordModel.getSource())}
            >
                {shortName(recordModel.getSource())}
            </a>
        </div>
    </div>
</div>;

SimilarMatch.contextTypes = childContextTypes;

const Similar = (props: Props, {gettext}: Context) => {
    const {similar} = props;

    return <div className="col-md-3">
        <a href="?compare" className="btn btn-success btn-block"
            style={{marginBottom: 20}}
        >
            {gettext("Compare Images")} &raquo;
        </a>

        <div className="panel panel-default">
            <div className="panel-heading">
                {gettext("Similar Images")}
            </div>
            <div className="panel-body row">
                {similar.map((match) => match.recordModel &&
                    <SimilarMatch {...props} match={match} key={match._id} />)}
            </div>
        </div>
    </div>;
};

Similar.contextTypes = childContextTypes;

const Script = () => <script
    dangerouslySetInnerHTML={{__html: `
        $(function() {
            $(".carousel").carousel();
        });
    `}}
/>;

const Record = (props: Props, {URL}: Context) => {
    const {records, similar} = props;
    const record = records[0];
    const title = options.types[record.type]
        .recordTitle(record, props);
    const social = {
        imgURL: record.getOriginalURL(),
        title,
        url: URL(record),
    };

    return <Page
        title={title}
        scripts={<Script/>}
        social={social}
    >
        <div className="row">
            <MainRecord {...props} />
            {similar.length > 0 && <Similar {...props} />}
        </div>
    </Page>;
};

Record.contextTypes = childContextTypes;

module.exports = Record;
