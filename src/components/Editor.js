import Draft from 'draft-js';
import {Map} from 'immutable';
import React from 'react';
import ReactDOM from 'react-dom';

import MediaComponent from './MediaComponent';
import SideControl from './SideControl/SideControl'
import PopoverControl from './PopoverControl/PopoverControl'
import generateUniqueType from './../lib/generateUniqueType.js'
import Image from './Image.js'
import MediaWrapper from './MediaWrapper.js'
import getUnboundedScrollPosition from 'fbjs/lib/getUnboundedScrollPosition.js'
import Style from 'fbjs/lib/Style.js'
import defaultDecorator from './defaultDecorator.js'

var {ContentState, Editor, EditorState, RichUtils, Entity, 
  CompositeDecorator, convertFromRaw, convertToRaw} = Draft;

var getSelectedBlockElement = (range) => {
  var node = range.startContainer
  do {
    if (node.getAttribute && node.getAttribute('data-block') == 'true')
      return node
    node = node.parentNode
  } while (node != null)
  return null
  /*const currentContent = this.props.editorState.getCurrentContent()
  const selection = this.props.editorState.getSelection()
  return currentContent.getBlockForKey(selection.getStartKey())*/
};

var getSelectionRange = () => {
  var selection = window.getSelection()
  if (selection.rangeCount == 0) return null
  return selection.getRangeAt(0)
};

const isParentOf = (ele, maybeParent) => {

  while (ele.parentNode != null && ele.parentNode != document.body){
    if (ele.parentNode == maybeParent) return true
    ele = ele.parentNode
  }
  return false
}

const styles = {
  editorContainer: {
    position: 'relative',
    //paddingLeft: 48,
  },
  popOverControl: {
    //width: 78, // Height and width are needed to compute the position
    height: 24,
    display: 'none', 
    position: 'absolute',
    zIndex: 999,
  },
  sideControl: {
    height: 24, // Required to figure out positioning
    //width: 48, // Needed to figure out how much to offset the sideControl left
    left: -24,
    display: 'none',
  }
}

const popoverSpacing = 3 // The distance above the selection that popover 
  // will display



export default class RichEditor extends React.Component {

  static propTypes = {
    blockTypes: React.PropTypes.object,
    readOnly: React.PropTypes.bool,
    /**
     * The root component class name.
     */
    className: React.PropTypes.string,

    /**
     * The icon fill colour
     */
    iconColor: React.PropTypes.string,

    /**
     * The icon fill colour when selected
     */
    iconSelectedColor: React.PropTypes.string,

    /**
     * Override the inline styles for the popover component.
     */
    popoverStyle: React.PropTypes.object,

    /**
     * Override the inline buttons, these are displayed in the popover control.
     */
    inlineButtons: React.PropTypes.array,

    /**
     * Override the block buttons, these are displayed in the "more options" 
     * side control.
     */
    blockButtons: React.PropTypes.array,
  };

  static defaultProps = {
    blockTypes: {
      'image': Image,
    },
    iconColor: '#000000',
    iconSelectedColor: '#2000FF',
    //editorState: EditorState.createEmpty(defaultDecorator),
    onChange: function(){},
  };

  state = {};

  constructor(props) {
    super(props);

    if (props.decorator)
      throw new Error(`Passing in a decorator is deprecated, you must first 
        create an editorState object using your decorator and pass in that
        editorState object instead. e.g. EditorState.createEmpty(decorator)`)

    if (props.editorState instanceof ContentState)
      throw new Error(`You passed in a ContentState object when an EditorState 
        object was expected, use EditorState.createWithContent first.`)

    if (props.editorState != null && 
      !(props.editorState instanceof EditorState))
     throw new Error('Invalid editorState')
    
    /*if (props.editorState == null){
      throw new Error(`editorState prop missing, you can create one with 
        EditorState.createEmpty(defaultDecorator), you can import the 
        defaultDecorator with import { defaultDecorator } form 'draft-js-editor'`)
    }*/
    this._blockRenderer = (block) => {

      var type = block.getType()

      var Component = this.props.blockTypes[type]

      if (Component){
        return {
          component: MediaWrapper,
          props: {
            child: <Component />,
          }
        }
      }
      return null;
    };

    

    this.updateSelection = () => {
      
      var selectionRangeIsCollapsed = null,
        sideControlVisible = false,
        sideControlTop = null,
        sideControlLeft = styles.sideControl.left,
        popoverControlVisible = false,
        popoverControlTop = null,
        popoverControlLeft = null
      
      
      let selectionRange = getSelectionRange()
      if (!selectionRange) return
      
      var editorEle = ReactDOM.findDOMNode(this.refs['editor'])
      if (!isParentOf(selectionRange.commonAncestorContainer, editorEle))
        return

      var popoverControlEle = ReactDOM.findDOMNode(this.refs['popoverControl'])
      var sideControlEle = ReactDOM.findDOMNode(this.refs['sideControl'])

      let rangeBounds = selectionRange.getBoundingClientRect()
      var selectedBlock = getSelectedBlockElement(selectionRange)
      if (selectedBlock){
        var blockBounds = selectedBlock.getBoundingClientRect()

        sideControlVisible = true
        //sideControlTop = this.state.selectedBlock.offsetTop
        var editorBounds = this.state.editorBounds
        if (!editorBounds) return
        var sideControlTop = (blockBounds.top - editorBounds.top)
          + ((blockBounds.bottom - blockBounds.top) / 2)
          - (styles.sideControl.height / 2)

        //console.log(require('util').inspect(sideControlTop))
          
        sideControlEle.style.left = sideControlLeft + 'px'
        sideControlEle.style.top = sideControlTop + 'px'
        sideControlEle.style.display = 'block'
  
        if (!selectionRange.collapsed){

          // The control needs to be visible so that we can get it's width
          popoverControlEle.style.display = 'block'
          var popoverWidth = popoverControlEle.clientWidth



          popoverControlVisible = true
          var rangeWidth = rangeBounds.right - rangeBounds.left,
            rangeHeight = rangeBounds.bottom - rangeBounds.top
          popoverControlTop = (rangeBounds.top - editorBounds.top)
            - styles.popOverControl.height
            - popoverSpacing
          popoverControlLeft = 0
            + (rangeBounds.left - editorBounds.left)
            + (rangeWidth / 2)
            - (/*styles.popOverControl.width*/ popoverWidth / 2)


          //console.log(popoverControlEle)
          //console.log(popoverControlEle.style)
          popoverControlEle.style.left = popoverControlLeft + 'px'
          popoverControlEle.style.top = popoverControlTop + 'px'
        } else {
          popoverControlEle.style.display = 'none'
        }
      } else {
        sideControlEle.style.display = 'none'
        popoverControlEle.style.display = 'none'
      }
    };
    

  };

  _onChange = (editorState) => this.props.onChange(editorState);

  _focus = () => {
    if (this.props.readOnly) return

    var editorNode = ReactDOM.findDOMNode(this.refs['editor'])
    var editorBounds = editorNode.getBoundingClientRect()
    this.setState({
      editorBounds,
    })

    var scrollParent = Style.getScrollParent(editorNode);
    //console.log(`focus called: ${require('util').inspect(getUnboundedScrollPosition(scrollParent))}`)
    this.refs.editor.focus(getUnboundedScrollPosition(scrollParent));
    //this.refs.editor.focus();
  };

  componentDidUpdate = () => this.updateSelection();

  onEditorChange = (editorState) => {
    var { onChange } = this.props
    onChange(editorState)
  };

  onBlur = () => {
    var popoverControlEle = ReactDOM.findDOMNode(this.refs['popoverControl'])
    var sideControlEle = ReactDOM.findDOMNode(this.refs['sideControl'])
    popoverControlEle.style.display = 'none'
    sideControlEle.style.display = 'none'
  };

  /**
   * While editing TeX, set the Draft editor to read-only. This allows us to
   * have a textarea within the DOM.
   */
  render() {
    var { 
      iconColor, 
      iconSelectedColor,
      popoverStyle,
      inlineButtons,
      blockButtons,
      editorState,
      ...otherProps, } = this.props

    if (!editorState){
      editorState = EditorState.createEmpty(defaultDecorator)
      this._onChange(editorState)
    }

    var currentInlineStyle = editorState.getCurrentInlineStyle();

    const selection = editorState.getSelection();
    const selectedBlockType = editorState
      .getCurrentContent()
      .getBlockForKey(selection.getStartKey())
      .getType();

    var sideControlStyles = Object.assign({}, styles.sideControl)
    /*if (this.props.readOnly != true && this.state.sideControlVisible){
      sideControlStyles.display = 'block'
    }*/

    var popoverStyleLocal = Object.assign({}, styles.popOverControl)
    /*if (this.props.readOnly != true && this.state.popoverControlVisible){
      popoverStyleLocal.display = 'block'
    }*/
    Object.assign(popoverStyleLocal, popoverStyle)

    return (
      <div style={Object.assign({}, styles.editorContainer, this.props.style)} 
        className={this.props.className} onClick={this._focus}>
        <SideControl style={sideControlStyles} 
          iconSelectedColor={iconSelectedColor}
          iconColor={iconColor}
          popoverStyle={popoverStyle}
          ref="sideControl"
          buttons={blockButtons}
          editorState={editorState}
          updateEditorState={this.onEditorChange}
        />
        <PopoverControl 
          style={popoverStyleLocal} 
          editorState={editorState}
          iconSelectedColor={iconSelectedColor}
          iconColor={iconColor}
          updateEditorState={this.onEditorChange}
          ref="popoverControl"
          buttons={inlineButtons}
        />
        <Editor
          blockRendererFn={this._blockRenderer}
          spellCheck={true}
          {...otherProps}
          editorState={editorState}
          onChange={this._onChange}
          ref="editor"
          onBlur={this.onBlur}
        />
      </div>
        
    );
  }
}
